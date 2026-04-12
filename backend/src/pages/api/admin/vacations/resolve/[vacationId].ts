import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import { 
  responseErrorEntryNotFound, 
  responseErrorIncorrectParameter, 
  responseErrorMethodNotAllowed, 
  responseErrorPost 
} from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();
    const vacationId = req.query.vacationId as string;
    const { status } = req.body;

    console.log('Resolving vacation:', { vacationId, status });

    if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      return responseErrorIncorrectParameter(res, 'status');
    }

    // First, find the vacation to get user and date info
    const vacation = await ElectiveVacation.findById(vacationId);
    
    if (!vacation) {
      return responseErrorEntryNotFound(res, "Vacation");
    }

    // Get the old status for comparison
    const oldStatus = vacation.status;
    
    // Update the vacation status
    const updateData: any = { status };
    if (status === 'approved') {
      updateData.approvedBy = req.user?.userId;
      updateData.approvedAt = new Date();
    }
    await ElectiveVacation.findByIdAndUpdate(vacationId, updateData);

    // If the status changed to or from 'approved', update the user's yearly vacation days
    if (oldStatus !== status && (oldStatus === 'approved' || status === 'approved')) {
      await updateUserYearlyVacationDays(vacation.userId, vacation.date, status === 'approved');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Resolve vacation error:', error);
    return responseErrorPost(res);
  }
}

// Helper function to update user's yearly vacation days
async function updateUserYearlyVacationDays(userId: string, date: Date, isApproved: boolean) {
  try {
    const year = date.getFullYear();
    const vacationDate = new Date(date);
    vacationDate.setHours(0, 0, 0, 0);

    let userYearlyVacationDays = await YearlyVacationDays.findOne({
      year,
      userId
    });

    if (!userYearlyVacationDays) {
      const baseYearlyVacationDays = await YearlyVacationDays.findOne({
        year,
        userId: undefined
      });

      if (!baseYearlyVacationDays) {
        userYearlyVacationDays = await YearlyVacationDays.create({
          userId,
          year,
          obligatoryDays: [],
          electiveDaysTotalCount: 0,
          selectedElectiveDays: isApproved ? [vacationDate] : [],
        });
      } else {
        userYearlyVacationDays = await YearlyVacationDays.create({
          userId,
          year,
          obligatoryDays: baseYearlyVacationDays.obligatoryDays,
          electiveDaysTotalCount: baseYearlyVacationDays.electiveDaysTotalCount,
          selectedElectiveDays: isApproved ? [vacationDate] : [],
        });
      }
    } else {
      const existingDates = userYearlyVacationDays.selectedElectiveDays.map((d: any) => {
        const d2 = new Date(d);
        d2.setHours(0, 0, 0, 0);
        return d2.getTime();
      });
      const newDateTime = vacationDate.getTime();
      const dateExists = existingDates.includes(newDateTime);

      let newSelectedDays: Date[];
      if (isApproved && !dateExists) {
        const newDays = [...userYearlyVacationDays.selectedElectiveDays, vacationDate];
        newSelectedDays = newDays.sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());
      } else if (!isApproved && dateExists) {
        newSelectedDays = userYearlyVacationDays.selectedElectiveDays.filter((selectedDate: any) => {
          const normalizedSelectedDate = new Date(selectedDate);
          normalizedSelectedDate.setHours(0, 0, 0, 0);
          return normalizedSelectedDate.getTime() !== vacationDate.getTime();
        });
      } else {
        newSelectedDays = userYearlyVacationDays.selectedElectiveDays;
      }

      await YearlyVacationDays.findByIdAndUpdate(userYearlyVacationDays._id, {
        selectedElectiveDays: newSelectedDays,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating user yearly vacation days:', error);
  }
}

export default requireRole(['admin'], handler);