import { ElectiveVacationSchema, GroupSchema, UserSchema, WorkSessionReasonSchema, WorkSessionSchema, YearlyVacationDaysSchema } from '@/schemas/database';
import { z } from 'zod';

const FeUserSchema = UserSchema.extend({_id: z.string()});
const FeGroupSchema = GroupSchema.extend({_id: z.string()});
const FeWorkSessionReasonSchema = WorkSessionReasonSchema.extend({_id: z.string()});
const FeWorkSessionSchema = WorkSessionSchema.extend({_id: z.string()});
const FeElectiveVacationSchema = ElectiveVacationSchema.extend({_id: z.string()});
const FeYearlyVacationDaysSchema = YearlyVacationDaysSchema.extend({_id: z.string()});

export type User = z.infer<typeof FeUserSchema>;
export type Group = z.infer<typeof FeGroupSchema>;
export type WorksessionReason = z.infer<typeof FeWorkSessionReasonSchema>;
export type WorkSession = z.infer<typeof FeWorkSessionSchema>;
export type ElectiveVacation = z.infer<typeof FeElectiveVacationSchema>;
export type YearlyVacationDays = z.infer<typeof FeYearlyVacationDaysSchema>;