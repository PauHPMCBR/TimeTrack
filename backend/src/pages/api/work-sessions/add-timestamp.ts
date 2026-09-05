import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import {
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { WorkSessionRequestSchema } from 'shared/src/schemas/api';
import { computeDayHours } from 'shared/src/lib/work-hours';
import { CheckInIncorrectParameterReason } from 'shared/src/types/response-errors';
import { withUserLock } from '@/lib/user-lock';
import { todayRange } from '@/lib/date-range';
import {
    CHECK_IN,
    CHECK_OUT,
    SOURCE_AUTOMATIC,
    SOURCE_USER,
    SESSION_ACTIVE,
    SESSION_REPLACED,
} from 'shared/src/lib/constants';

// Fetches today's active sessions once (ascending) and derives from them the
// in/out guard (ignoring programmed future automatic sessions) and the day's
// worked hours. Day boundary is the server's local time — same convention as
// every other date-bucketed endpoint in the app. Replaced versions of the day
// are excluded: only the current record drives the in/out guard.
async function getTodaySessions(
    userId: string
): Promise<InstanceType<typeof WorkSession>[]> {
    const { start, end } = todayRange();

    return WorkSession.find({
        userId: userId,
        timestamp: { $gte: start, $lt: end },
        status: { $ne: SESSION_REPLACED },
    }).sort({ timestamp: 1 });
}

function verifyInOut(
    lastSession: InstanceType<typeof WorkSession> | undefined,
    type: string
): CheckInIncorrectParameterReason | null {
    if (type === CHECK_IN) {
        if (lastSession && lastSession.type === CHECK_IN) {
            return 'AlreadyCheckedIn';
        }
    } else if (type === CHECK_OUT) {
        if (!lastSession) {
            return 'NoEntryToday';
        }
        if (lastSession.type === CHECK_OUT) {
            return 'AlreadyCheckedOut';
        }
    }

    return null;
}

// A future-dated session written by the automatic timetable is "programmed",
// not real yet. Manual punches must be able to override it: otherwise a
// programmed check-out later today always sorts last and the in/out guard
// would allow unlimited consecutive check-ins.
function isProgrammed(
    session: InstanceType<typeof WorkSession>,
    now: Date
): boolean {
    return (
        session.source === SOURCE_AUTOMATIC &&
        new Date(session.timestamp).getTime() > now.getTime()
    );
}

type CheckInOutResult =
    | { error: CheckInIncorrectParameterReason }
    | {
          workSession: InstanceType<typeof WorkSession>;
          hoursWorked: number | null;
      };

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(WorkSessionRequestSchema),
            req,
            res
        ))
    )
        return;

    const { type, notes } = req.body;

    try {
        await dbConnect();

        if (![CHECK_IN, CHECK_OUT].includes(type)) {
            return responseErrorIncorrectParameter(res, 'type');
        }

        const result = await withUserLock<CheckInOutResult>(
            req.user!.userId,
            async () => {
                const todaySessions = await getTodaySessions(req.user!.userId);
                const now = new Date();

                // Manual punch vs programmed automatic sessions: scheduled
                // future check-outs/check-ins of the auto timetable are
                // superseded by any real punch. A manual check-in also
                // supersedes the open automatic check-in (the start of the
                // interval being lived through), since the punch redefines
                // when work actually started.
                const overridden = todaySessions.filter((s) =>
                    isProgrammed(s, now)
                );
                const effective = todaySessions.filter(
                    (s) => !isProgrammed(s, now)
                );
                if (type === CHECK_IN) {
                    const last = effective[effective.length - 1];
                    if (
                        last &&
                        last.type === CHECK_IN &&
                        last.source === SOURCE_AUTOMATIC
                    ) {
                        overridden.push(last);
                        effective.pop();
                    }
                }

                const inOutCheckError = verifyInOut(
                    effective[effective.length - 1],
                    type
                );
                if (inOutCheckError !== null) {
                    return { error: inOutCheckError };
                }

                const currentVersion = todaySessions[0]?.version ?? 1;

                if (overridden.length > 0) {
                    await WorkSession.updateMany(
                        { _id: { $in: overridden.map((s) => s._id) } },
                        {
                            $set: {
                                status: SESSION_REPLACED,
                                replacedByVersion: currentVersion,
                                replacedAt: now,
                                updatedAt: now,
                            },
                        }
                    );
                }

                const workSession = new WorkSession({
                    userId: req.user!.userId,
                    type,
                    timestamp: now,
                    source: SOURCE_USER,
                    notes,
                    // Join the day's current version (all active docs of a
                    // day share it); days never touched by a replacement
                    // (or legacy days) are version 1.
                    version: currentVersion,
                    status: SESSION_ACTIVE,
                });

                await workSession.save();

                let hoursWorked = null;
                if (type === CHECK_OUT) {
                    hoursWorked = computeDayHours([
                        ...effective,
                        workSession,
                    ]).totalHours;
                }

                return { workSession, hoursWorked };
            }
        );

        if ('error' in result) {
            return responseErrorIncorrectParameter(res, 'type', [result.error]);
        }

        res.status(201).json({
            success: true,
            data: {
                message:
                    type === CHECK_IN
                        ? 'CheckInRegistered'
                        : 'CheckOutRegistered',
                session: result.workSession,
                hoursWorked: result.hoursWorked,
            },
        });
    } catch (error) {
        console.error('Work session error:', error);
        return responseErrorPost(res);
    }
}

export default authenticateToken(handler);
