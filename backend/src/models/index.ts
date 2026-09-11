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
    MonthlyApprovalSchema,
    MonthlyApprovalEventSchema,
    AuditEventSchema,
    UserFileSchema,
    WorkDaySourceSchema,
} from 'shared/src/schemas/database';
import { extendZod, zodSchema } from '@zodyac/zod-mongoose';
import { z } from 'zod';
import { decrypt, encrypt, lookupHash } from '@/lib/crypto';

extendZod(z);

const zUserSchema = zodSchema(UserSchema);
zUserSchema.index({ email: 1, registered: 1 });
zUserSchema.index({ registrationToken: 1 });
zUserSchema.index({ emailHash: 1 }); // hash for lookups
zUserSchema.index({ dniHash: 1 });
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

function encryptUserSecrets(doc: {
    email?: unknown;
    dni?: unknown;
    emailEncrypted?: string;
    dniEncrypted?: string;
    emailHash?: string;
    dniHash?: string;
}) {
    if (typeof doc.email === 'string' && doc.email) {
        doc.emailEncrypted = encrypt(doc.email);
        doc.emailHash = lookupHash(doc.email);
        doc.email = undefined;
    }
    if (typeof doc.dni === 'string' && doc.dni) {
        doc.dniEncrypted = encrypt(doc.dni);
        doc.dniHash = lookupHash(doc.dni);
        doc.dni = undefined;
    }
}

function hydrateUserSecrets(doc: unknown): void {
    if (!doc || typeof doc !== 'object') return;
    const d = doc as Record<string, unknown>;
    if (typeof d.emailEncrypted === 'string' && d.emailEncrypted) {
        d.email = decrypt(d.emailEncrypted);
    }
    if (typeof d.dniEncrypted === 'string' && d.dniEncrypted) {
        d.dni = decrypt(d.dniEncrypted);
    }
}

zUserSchema.pre('save', function (next) {
    encryptUserSecrets(this);
    next();
});
zUserSchema.post('save', (doc) => hydrateUserSecrets(doc));
function hydrateUserSecretsAll(docs: unknown): void {
    if (Array.isArray(docs)) docs.forEach(hydrateUserSecrets);
    else hydrateUserSecrets(docs);
}
const userQuerySchema = zUserSchema as unknown as mongoose.Schema;
userQuerySchema.post('find', hydrateUserSecretsAll);
userQuerySchema.post('findOne', hydrateUserSecrets);
userQuerySchema.post('findOneAndUpdate', hydrateUserSecrets);

function encryptFreeText(doc: {
    notes?: unknown;
    reason?: unknown;
    editReason?: unknown;
    notesEncrypted?: string;
    reasonEncrypted?: string;
    editReasonEncrypted?: string;
}) {
    if (typeof doc.notes === 'string' && doc.notes) {
        doc.notesEncrypted = encrypt(doc.notes);
        doc.notes = undefined;
    }
    if (typeof doc.reason === 'string' && doc.reason) {
        doc.reasonEncrypted = encrypt(doc.reason);
        doc.reason = undefined;
    }
    if (typeof doc.editReason === 'string' && doc.editReason) {
        doc.editReasonEncrypted = encrypt(doc.editReason);
        doc.editReason = undefined;
    }
}

function hydrateFreeText(doc: unknown): void {
    if (!doc || typeof doc !== 'object') return;
    const d = doc as Record<string, unknown>;
    if (typeof d.notesEncrypted === 'string' && d.notesEncrypted) {
        d.notes = decrypt(d.notesEncrypted);
    }
    if (typeof d.reasonEncrypted === 'string' && d.reasonEncrypted) {
        d.reason = decrypt(d.reasonEncrypted);
    }
    if (typeof d.editReasonEncrypted === 'string' && d.editReasonEncrypted) {
        d.editReason = decrypt(d.editReasonEncrypted);
    }
}

function hydrateFreeTextAll(docs: unknown): void {
    if (Array.isArray(docs)) docs.forEach(hydrateFreeText);
    else hydrateFreeText(docs);
}
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
zWorkSessionSchema.pre('save', function (next) {
    encryptFreeText(this);
    next();
});
zWorkSessionSchema.pre('insertMany', function (next, docs) {
    docs.forEach(encryptFreeText);
    next();
});
const workSessionQuerySchema =
    zWorkSessionSchema as unknown as mongoose.Schema;
workSessionQuerySchema.post('find', hydrateFreeTextAll);
workSessionQuerySchema.post('findOne', hydrateFreeTextAll);
workSessionQuerySchema.post('findOneAndUpdate', hydrateFreeTextAll);
workSessionQuerySchema.post('insertMany', hydrateFreeTextAll);

const zElectiveVacationSchema = zodSchema(ElectiveVacationSchema);
zElectiveVacationSchema.index({ userId: 1, startDate: 1 });
// Overlap checks filter by (userId, status) and the interval bounds.
zElectiveVacationSchema.index({ userId: 1, status: 1, startDate: 1, endDate: 1 });
zElectiveVacationSchema.index({ startDate: 1 });
zElectiveVacationSchema.pre('save', function (next) {
    encryptFreeText(this);
    next();
});
zElectiveVacationSchema.pre('insertMany', function (next, docs) {
    docs.forEach(encryptFreeText);
    next();
});
const vacationQuerySchema =
    zElectiveVacationSchema as unknown as mongoose.Schema;
vacationQuerySchema.post('find', hydrateFreeTextAll);
vacationQuerySchema.post('findOne', hydrateFreeTextAll);
vacationQuerySchema.post('findOneAndUpdate', hydrateFreeTextAll);
vacationQuerySchema.post('insertMany', hydrateFreeTextAll);

const zGroupSchema = zodSchema(GroupSchema);
zGroupSchema.index({ members: 1, name: 1 });

const zYearlyVacationDays = zodSchema(YearlyVacationDaysSchema);
zYearlyVacationDays.index({ userId: 1, year: 1 }, { unique: true });
// Global-template rows (userId absent) are looked up by year alone.
zYearlyVacationDays.index({ year: 1 });

const zAppSettings = zodSchema(AppSettingsSchema);

const zMonthlyApprovalSchema = zodSchema(MonthlyApprovalSchema);
// One approval document per (user, year, month).
zMonthlyApprovalSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });
// Reminder scans look for pending docs by requestedAt.
zMonthlyApprovalSchema.index({ status: 1, requestedAt: 1 });

// Append-only approval history: listed per (user, month) in chronological order.
const zMonthlyApprovalEventSchema = zodSchema(MonthlyApprovalEventSchema);
zMonthlyApprovalEventSchema.index({ userId: 1, year: 1, month: 1, timestamp: 1 });

// Append-only audit log: newest first for the admin review view.
const zAuditEventSchema = zodSchema(AuditEventSchema);
zAuditEventSchema.index({ timestamp: -1 });

const zUserFileSchema = zodSchema(UserFileSchema);
// Per-employee listings (user page + admin employee filter), newest first.
zUserFileSchema.index({ userId: 1, uploadedAt: -1 });
// Covered index for the storage-quota aggregate (sum of size across all docs).
zUserFileSchema.index({ size: 1 });

const zWorkDaySourceSchema = zodSchema(WorkDaySourceSchema);
zWorkDaySourceSchema.index({ userId: 1, date: 1 }, { unique: true });

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
    mongoose.models.AppSettings ||
    mongoose.model('AppSettings', zAppSettings);
export const MonthlyApproval =
    mongoose.models.MonthlyApproval ||
    mongoose.model('MonthlyApproval', zMonthlyApprovalSchema);
export const MonthlyApprovalEvent =
    mongoose.models.MonthlyApprovalEvent ||
    mongoose.model('MonthlyApprovalEvent', zMonthlyApprovalEventSchema);
export const AuditEvent =
    mongoose.models.AuditEvent ||
    mongoose.model('AuditEvent', zAuditEventSchema);
export const UserFile =
    mongoose.models.UserFile || mongoose.model('UserFile', zUserFileSchema);
export const WorkDaySource =
    mongoose.models.WorkDaySource ||
    mongoose.model('WorkDaySource', zWorkDaySourceSchema);