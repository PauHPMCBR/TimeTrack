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
    vacation.status = status;
    if (status === 'approved') {
      vacation.approvedBy = req.user?.userId;
      vacation.approvedAt = new Date();
    }
    await vacation.save();

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
    vacationDate.setHours(0, 0, 0, 0); // Normalize to start of day

    // Find or create the user's yearly vacation days
    let userYearlyVacationDays = await YearlyVacationDays.findOne({
      year,
      userId
    });

    if (!userYearlyVacationDays) {
      // Look for the base (global) template for this year
      const baseYearlyVacationDays = await YearlyVacationDays.findOne({
        year,
        userId: undefined // Global template has no userId
      });

      if (!baseYearlyVacationDays) {
        // Create a new yearly vacation days entry for the user
        userYearlyVacationDays = new YearlyVacationDays({
          userId,
          year,
          obligatoryDays: [],
          electiveDaysTotalCount: 0,
          selectedElectiveDays: isApproved ? [vacationDate] : [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        // Create a copy from the base template
        userYearlyVacationDays = new YearlyVacationDays({
          userId,
          year,
          obligatoryDays: baseYearlyVacationDays.obligatoryDays,
          electiveDaysTotalCount: baseYearlyVacationDays.electiveDaysTotalCount,
          selectedElectiveDays: isApproved ? [vacationDate] : [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } else {
      // Update existing user's yearly vacation days
      if (isApproved) {
        // Add date to selectedElectiveDays if not already present
        const dateExists = userYearlyVacationDays.selectedElectiveDays.some((selectedDate: any) => {
          const normalizedSelectedDate = new Date(selectedDate);
          normalizedSelectedDate.setHours(0, 0, 0, 0);
          return normalizedSelectedDate.getTime() === vacationDate.getTime();
        });

        if (!dateExists) {
          userYearlyVacationDays.selectedElectiveDays.push(vacationDate);
          userYearlyVacationDays.selectedElectiveDays.sort((a: any, b: any) => a.getTime() - b.getTime());
        }
      } else {
        // Remove date from selectedElectiveDays (when status changes from approved to something else)
        userYearlyVacationDays.selectedElectiveDays = userYearlyVacationDays.selectedElectiveDays.filter((selectedDate: any) => {
          const normalizedSelectedDate = new Date(selectedDate);
          normalizedSelectedDate.setHours(0, 0, 0, 0);
          return normalizedSelectedDate.getTime() !== vacationDate.getTime();
        });
      }
      userYearlyVacationDays.updatedAt = new Date();
    }

    await userYearlyVacationDays.save();
    console.log(`Updated yearly vacation days for user ${userId} in year ${year}:`, {
      selectedElectiveDays: userYearlyVacationDays.selectedElectiveDays.map((d: any) => d.toISOString().split('T')[0])
    });
  } catch (error) {
    console.error('Error updating user yearly vacation days:', error);
    // Don't throw - we don't want to fail the main request
  }
}

export default requireRole(['admin'], handler);