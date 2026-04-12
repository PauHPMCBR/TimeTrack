import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireSameGroupOrAdmin } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { UserYearParamSchema, YearlyVacationResponse } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(UserYearParamSchema);
    await new Promise((resolve, reject) => {
      validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
    });

  try {
    await dbConnect();
    const userId = req.query.userId as string;
    const year = parseInt(req.query.year as string);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    // 1. Recuperem les vacances (electives) sol·licitades
    const vacations = await ElectiveVacation.find({
      userId: userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    // 2. Busquem la Plantilla Global (Configuració Mestra)
    // Aquesta és la que conté el '22' que has canviat
    const globalSettings = await YearlyVacationDays.findOne({
      year: year,
      userId: undefined, // userId undefined indica que és la plantilla global
    });

    // 3. Busquem el registre específic de l'usuari
    let yearlyVacationDays = await YearlyVacationDays.findOne({
      year: year,
      userId: userId,
    });

    // --- NOVA LÒGICA DE SINCRONITZACIÓ ---
    
    if (!yearlyVacationDays) {
      if (globalSettings) {
        yearlyVacationDays = await YearlyVacationDays.create({
          userId: userId,
          year: year,
          obligatoryDays: globalSettings.obligatoryDays,
          electiveDaysTotalCount: globalSettings.electiveDaysTotalCount,
          selectedElectiveDays: [],
        });
      }
    } else {
      if (globalSettings) {
        let hasChanges = false;

        if (yearlyVacationDays.electiveDaysTotalCount !== globalSettings.electiveDaysTotalCount) {
          yearlyVacationDays.electiveDaysTotalCount = globalSettings.electiveDaysTotalCount;
          hasChanges = true;
        }

        if (JSON.stringify(yearlyVacationDays.obligatoryDays) !== JSON.stringify(globalSettings.obligatoryDays)) {
           yearlyVacationDays.obligatoryDays = globalSettings.obligatoryDays;
           hasChanges = true;
        }

        if (hasChanges) {
          await YearlyVacationDays.findByIdAndUpdate(yearlyVacationDays._id, {
            electiveDaysTotalCount: yearlyVacationDays.electiveDaysTotalCount,
            obligatoryDays: yearlyVacationDays.obligatoryDays,
          });
        }
      }
    }
    // -------------------------------------

    const response: YearlyVacationResponse = {
      year: year,
      electives: vacations,
      yearlyVacationDays: yearlyVacationDays
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get vacations error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);