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
    SOURCE_USER,
    SESSION_ACTIVE,
    SESSION_REPLACED,
} from 'shared/src/lib/constants';

// Fetches today's active sessions once (ascending) and derives both the
// last-session type (for the check_in/check_out guard) and the day's worked
// hours from it. Day boundary is the server's local time — same convention as
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
                const inOutCheckError = verifyInOut(
                    todaySessions[todaySessions.length - 1],
                    type
                );
                if (inOutCheckError !== null) {
                    return { error: inOutCheckError };
                }

                const workSession = new WorkSession({
                    userId: req.user!.userId,
                    type,
                    timestamp: new Date(),
                    source: SOURCE_USER,
                    notes,
                    // Join the day's current version (all active docs of a
                    // day share it); days never touched by a replacement
                    // (or legacy days) are version 1.
                    version: todaySessions[0]?.version ?? 1,
                    status: SESSION_ACTIVE,
                });

                await workSession.save();

                let hoursWorked = null;
                if (type === CHECK_OUT) {
                    hoursWorked = computeDayHours([
                        ...todaySessions,
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
