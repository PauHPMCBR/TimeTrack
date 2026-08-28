import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
    GroupSchema,
    UserSchema,
    ElectiveVacationSchema,
    WorkSessionSchema,
    YearlyVacationDaysSchema,
    WorkSessionReasonSchema,
    AppSettingsSchema,
} from 'shared/src/schemas/database';
import { extendZod, zodSchema } from '@zodyac/zod-mongoose';
import { z } from 'zod';

extendZod(z);

const zUserSchema = zodSchema(UserSchema);
zUserSchema.index({ email: 1, registered: 1 });
zUserSchema.index({ registrationToken: 1 });
zUserSchema.pre('save', async function (next) {
    // Only hash the password if it's modified (or new) and exists
    if (!this.isModified('password') || !this.password) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});
zUserSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const zWorkSessionReasonSchema = zodSchema(WorkSessionReasonSchema);

const zWorkSessionSchema = zodSchema(WorkSessionSchema);
zWorkSessionSchema.index({ userId: 1, timestamp: -1 });
// Admin "currently working" aggregation matches on timestamp alone.
zWorkSessionSchema.index({ timestamp: -1 });

const zElectiveVacationSchema = zodSchema(ElectiveVacationSchema);
zElectiveVacationSchema.index({ userId: 1, date: 1 });
zElectiveVacationSchema.index({ status: 1, date: 1 });
zElectiveVacationSchema.index({ date: 1 });

const zGroupSchema = zodSchema(GroupSchema);
zGroupSchema.index({ members: 1, name: 1 });

const zYearlyVacationDays = zodSchema(YearlyVacationDaysSchema);
zYearlyVacationDays.index({ userId: 1, year: 1 }, { unique: true });
// Global-template rows (userId absent) are looked up by year alone.
zYearlyVacationDays.index({ year: 1 });

const zAppSettings = zodSchema(AppSettingsSchema);

export const User = mongoose.models.User || mongoose.model('User', zUserSchema);
export const WorkSessionReason =
    mongoose.models.WorkSessionReason ||
    mongoose.model('WorkSessionReason', zWorkSessionReasonSchema);
export const WorkSession =
    mongoose.models.WorkSession ||
    mongoose.model('WorkSession', zWorkSessionSchema);
export const ElectiveVacation =
    mongoose.models.ElectiveVacation ||
    mongoose.model('ElectiveVacation', zElectiveVacationSchema);
export const Group =
    mongoose.models.Group || mongoose.model('Group', zGroupSchema);
export const YearlyVacationDays =
    mongoose.models.YearlyVacationDays ||
    mongoose.model('YearlyVacationDays', zYearlyVacationDays);
export const AppSettings =
    mongoose.models.AppSettings || mongoose.model('AppSettings', zAppSettings);
