import { z } from 'zod';
import { extendZod } from "@zodyac/zod-mongoose";
import mongoose from 'mongoose';

extendZod(z);

// User Schemas
export const UserRoleSchema = z.enum(['employee', 'admin']);
export const UserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  registrationToken: z.string(),
  registered: z.boolean().default(false),
  role: UserRoleSchema.default('employee'),
  groups: z.array(z.string()).default([]),
  failedLoginAttempts: z.number().int().gte(0).default(0),
  blocked: z.boolean().default(false),
  blockedSince: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Group Schemas
export const GroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  description: z.string().max(500).optional(),
  members: z.array(z.string()).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});


// Work Session Schemas
export const WorkSessionTypeSchema = z.enum(['check_in', 'check_out']);
export const WorkSessionReasonSchema = z.object({
  type: WorkSessionTypeSchema,
  reasonId: z.string(),
  englishText: z.string(),
  spanishText: z.string(),
  catalanText: z.string(),
});
export const WorkSessionSchema = z.object({
  userId: z.string(),
  type: WorkSessionTypeSchema,
  timestamp: z.date().default(() => new Date()),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  //ipAddress: z.string().optional(),
  //userAgent: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Vacation schemas
export const VacationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export const ElectiveVacationSchema = z.object({
  userId: z.string(),
  date: z.date(),
  status: VacationStatusSchema.default('pending'),
  reason: z.string().max(1000).optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  notes: z.string().max(1000).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const YearlyVacationDaysSchema = z.object({
  userId: z.string().optional(), // if userId is not set, it's the template for all users (and selectedElectiveDays should be empty)
  year: z.number(),
  obligatoryDays: z.array(z.date()),
  electiveDaysTotalCount: z.number().gte(0),
  selectedElectiveDays: z.array(z.date()),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
