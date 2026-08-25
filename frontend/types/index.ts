import { z } from "zod";
import { ElectiveVacationSchema, GroupSchema, UserSchema, WorkSessionReasonSchema, WorkSessionSchema, YearlyVacationDaysSchema } from "@/schemas/database";

export type User = z.infer<typeof UserSchema> & { _id: string };
export type Group = z.infer<typeof GroupSchema> & { _id: string };
export type WorksessionReason = z.infer<typeof WorkSessionReasonSchema> & { _id: string };
export type WorkSession = z.infer<typeof WorkSessionSchema> & { _id: string };
export type ElectiveVacation = z.infer<typeof ElectiveVacationSchema> & { _id: string };
export type YearlyVacationDays = z.infer<typeof YearlyVacationDaysSchema> & { _id: string };
