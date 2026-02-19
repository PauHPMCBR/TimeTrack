import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { GroupSchema, UserSchema, ElectiveVacationSchema, WorkSessionSchema, YearlyVacationDaysSchema, WorkSessionReasonSchema } from 'shared/src/schemas/database';
import { zodSchema } from "@zodyac/zod-mongoose";

const zUserSchema = zodSchema(UserSchema);
zUserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new) and exists
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});
zUserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const zWorkSessionReasonSchema = zodSchema(WorkSessionReasonSchema);

const zWorkSessionSchema = zodSchema(WorkSessionSchema);
zWorkSessionSchema.index({ userId: 1, timestamp: -1 });

const zElectiveVacationSchema = zodSchema(ElectiveVacationSchema);
zElectiveVacationSchema.index({ status: 1, startDate: 1 });

const zGroupSchema = zodSchema(GroupSchema);

const zYearlyVacationDays = zodSchema(YearlyVacationDaysSchema);
// Compound index for user-year uniqueness
zYearlyVacationDays.index({ userId: 1, year: 1 }, { unique: true });

// Export models
export const User = mongoose.models.User || mongoose.model('User', zUserSchema);
export const WorkSessionReason = mongoose.models.WorkSessionReason || mongoose.model('WorkSessionReason', zWorkSessionReasonSchema);
export const WorkSession = mongoose.models.WorkSession || mongoose.model('WorkSession', zWorkSessionSchema);
export const ElectiveVacation = mongoose.models.ElectiveVacation || mongoose.model('ElectiveVacation', zElectiveVacationSchema);
export const Group = mongoose.models.Group || mongoose.model('Group', zGroupSchema);
export const YearlyVacationDays = mongoose.models.YearlyVacationDays || mongoose.model('YearlyVacationDays', zYearlyVacationDays);