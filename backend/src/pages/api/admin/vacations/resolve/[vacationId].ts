import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import { runInTransaction } from '@/lib/transaction';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';

type ClientSession = Awaited<
    ReturnType<(typeof import('mongoose'))['default']['startSession']>
> | null;

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const vacationId = req.query.vacationId as string;
        const { status } = req.body;

        if (
            !['pending', 'approved', 'rejected', 'cancelled'].includes(status)
        ) {
            return responseErrorIncorrectParameter(res, 'status');
        }

        // The vacation status and the user's yearly-days counter must change
        // atomically; a failure updating the counter rolls back the status change.
        await runInTransaction(async (session) => {
            const vacation = await ElectiveVacation.findById(
                vacationId,
                null,
                session ? { session } : undefined
            );

            if (!vacation) {
                throw new Error('VacationNotFound');
            }

            const oldStatus = vacation.status;

            const updateData: {
                status: string;
                approvedBy?: string;
                approvedAt?: Date;
            } = { status };
            if (status === 'approved') {
                updateData.approvedBy = req.user?.userId;
                updateData.approvedAt = new Date();
            }
            await ElectiveVacation.findByIdAndUpdate(
                vacationId,
                updateData,
                session ? { session } : undefined
            );

            if (
                oldStatus !== status &&
                (oldStatus === 'approved' || status === 'approved')
            ) {
                await updateUserYearlyVacationDays(
                    vacation.userId,
                    vacation.date,
                    status === 'approved',
                    session
                );
            }
        });

        res.status(200).json({ success: true });
    } catch (error) {
        if ((error as Error).message === 'VacationNotFound') {
            return responseErrorEntryNotFound(res, 'Vacation');
        }
        console.error('Resolve vacation error:', error);
        return responseErrorPost(res);
    }
}

// Helper function to update user's yearly vacation days. Throws on failure so
// the surrounding transaction can roll back.
async function updateUserYearlyVacationDays(
    userId: string,
    date: Date,
    isApproved: boolean,
    session: ClientSession
) {
    const year = date.getFullYear();
    const vacationDate = new Date(date);
    vacationDate.setHours(0, 0, 0, 0);

    const userYearlyVacationDays = await YearlyVacationDays.findOne(
        { year, userId },
        null,
        session ? { session } : undefined
    );

    if (!userYearlyVacationDays) {
        const baseYearlyVacationDays = await YearlyVacationDays.findOne(
            { year, userId: undefined },
            null,
            session ? { session } : undefined
        );

        if (!baseYearlyVacationDays) {
            await YearlyVacationDays.create(
                [
                    {
                        userId,
                        year,
                        obligatoryDays: [],
                        electiveDaysTotalCount: 0,
                        selectedElectiveDays: isApproved ? [vacationDate] : [],
                    },
                ],
                session ? { session } : undefined
            );
        } else {
            await YearlyVacationDays.create(
                [
                    {
                        userId,
                        year,
                        obligatoryDays: baseYearlyVacationDays.obligatoryDays,
                        electiveDaysTotalCount:
                            baseYearlyVacationDays.electiveDaysTotalCount,
                        selectedElectiveDays: isApproved ? [vacationDate] : [],
                    },
                ],
                session ? { session } : undefined
            );
        }
    } else {
        const existingDates = userYearlyVacationDays.selectedElectiveDays.map(
            (d: Date) => {
                const d2 = new Date(d);
                d2.setHours(0, 0, 0, 0);
                return d2.getTime();
            }
        );
        const newDateTime = vacationDate.getTime();
        const dateExists = existingDates.includes(newDateTime);

        let newSelectedDays: Date[];
        if (isApproved && !dateExists) {
            const newDays = [
                ...userYearlyVacationDays.selectedElectiveDays,
                vacationDate,
            ];
            newSelectedDays = newDays.sort(
                (a: Date, b: Date) =>
                    new Date(a).getTime() - new Date(b).getTime()
            );
        } else if (!isApproved && dateExists) {
            newSelectedDays =
                userYearlyVacationDays.selectedElectiveDays.filter(
                    (selectedDate: Date) => {
                        const normalizedSelectedDate = new Date(selectedDate);
                        normalizedSelectedDate.setHours(0, 0, 0, 0);
                        return (
                            normalizedSelectedDate.getTime() !==
                            vacationDate.getTime()
                        );
                    }
                );
        } else {
            newSelectedDays = userYearlyVacationDays.selectedElectiveDays;
        }

        await YearlyVacationDays.findByIdAndUpdate(
            userYearlyVacationDays._id,
            {
                selectedElectiveDays: newSelectedDays,
                updatedAt: new Date(),
            },
            session ? { session } : undefined
        );
    }
}

export default requireRole(['admin'], handler);
