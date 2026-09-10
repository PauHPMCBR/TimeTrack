import { AuditEvent } from '@/models';
import type { AuthRequest } from '@/lib/auth';
import type { AuditAction } from 'shared/src/schemas/database';

/**
 * Client IP for audit entries: the reverse-proxy header when present, else
 * the socket address. Never throws.
 */
export function clientIpOf(req: AuthRequest): string {
    try {
        const fwd = req.headers['x-forwarded-for'];
        if (typeof fwd === 'string' && fwd.length > 0) {
            return fwd.split(',')[0].trim();
        }
        return req.socket?.remoteAddress ?? '';
    } catch {
        return '';
    }
}

export interface AuditEntry {
    actorId?: string;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Appends one entry to the security/audit log. Insert-only; a failed write
 * is logged but never fails the request that produced it.
 */
export async function audit(entry: AuditEntry): Promise<void> {
    try {
        await AuditEvent.create({
            actorId: entry.actorId ?? '',
            action: entry.action,
            targetType: entry.targetType ?? '',
            targetId: entry.targetId ?? '',
            ip: entry.ip ?? '',
            metadata: entry.metadata
                ? JSON.stringify(entry.metadata)
                : '',
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Audit log write failed:', error);
    }
}
