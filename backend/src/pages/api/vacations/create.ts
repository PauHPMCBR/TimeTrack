import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import { responseErrorIllegalAction, responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { ElectiveVacationRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  console.log(req.body);

  const validationMiddleware = validateRequestBody(ElectiveVacationRequestSchema);
       await new Promise((resolve, reject) => {
          validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
        });

  try {
    await dbConnect();
    const { date, reason } = req.body;
    const userId = req.user!.userId;

    const requestDate = new Date(date);
    const startOfDay = new Date(Date.UTC(
      requestDate.getUTCFullYear(),
      requestDate.getUTCMonth(),
      requestDate.getUTCDate(),
      0, 0, 0, 0
    ));
    
    const endOfDay = new Date(Date.UTC(
      requestDate.getUTCFullYear(),
      requestDate.getUTCMonth(),
      requestDate.getUTCDate(),
      23, 59, 59, 999
    ));

    let yearlyVacationDays = await YearlyVacationDays.findOne({
      year: requestDate.getFullYear(),
      userId: userId,
    });

    if (!yearlyVacationDays) {
      const globalConfig = await YearlyVacationDays.findOne({
        year: requestDate.getFullYear(),
        userId: undefined,
      });
      
      if (!globalConfig) {
        return responseErrorIllegalAction(res, 'NoVacationConfig');
      }
      
      yearlyVacationDays = await YearlyVacationDays.create({
        userId: userId,
        year: globalConfig.year,
        obligatoryDays: globalConfig.obligatoryDays,
        electiveDaysTotalCount: globalConfig.electiveDaysTotalCount,
        selectedElectiveDays: [],
      });
    }

    if (yearlyVacationDays.selectedElectiveDays.length >= yearlyVacationDays.electiveDaysTotalCount) {
      return responseErrorIllegalAction(res, 'AllVacationsUsed');
    }

    const sameDayVacations = await ElectiveVacation.find({
      userId: userId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['pending', 'approved'] }
    });

    if (sameDayVacations.length > 0) {
      return responseErrorIllegalAction(res, 'DuplicateVacationRequest');
    }

    const isObligatoryDay = yearlyVacationDays.obligatoryDays.some((obligatoryDate: any) => {
      const obligatory = new Date(obligatoryDate);
      return obligatory >= startOfDay && obligatory <= endOfDay;
    });

    if (isObligatoryDay) {
      return responseErrorIllegalAction(res, 'AlreadyObligatoryVacation');
    }


    const elective = await ElectiveVacation.create({
        userId: req.user!.userId,
        date: new Date(date),
        reason: reason,
    });

    res.status(201).json({ vacation: elective });
  } catch (error) {
    console.error('Create elective vacation error:', error);
    return responseErrorPost(res);
  }
}

export default authenticateToken(handler);