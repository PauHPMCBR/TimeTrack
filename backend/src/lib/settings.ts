import dbConnect from '@/lib/mongodb';
import { AppSettings } from '@/models';

export interface AppSettingsValues {
  defaultExpectedHours: number;
  benevolenceHours: number;
  endOfDayHour: number;
}

const DEFAULTS: AppSettingsValues = {
  defaultExpectedHours: 8,
  benevolenceHours: 1,
  endOfDayHour: 20,
};

/**
 * Returns the company-wide settings document, lazily creating it (with the
 * defaults) on first access. A singleton is enforced by always reading the
 * first document in the collection.
 */
export async function getAppSettings(): Promise<AppSettingsValues> {
  await dbConnect();

  let settings = await AppSettings.findOne({});
  if (!settings) {
    settings = await AppSettings.create(DEFAULTS);
  }

  return {
    defaultExpectedHours: settings.defaultExpectedHours ?? DEFAULTS.defaultExpectedHours,
    benevolenceHours: settings.benevolenceHours ?? DEFAULTS.benevolenceHours,
    endOfDayHour: settings.endOfDayHour ?? DEFAULTS.endOfDayHour,
  };
}