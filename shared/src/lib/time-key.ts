import { z } from 'zod';

// Kept local to avoid an import cycle: constants.ts derives its enum
// constants from schemas/database.ts, which imports this module.
const HOUR_MINUTE_KEY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Unbranded equivalent for database schemas (@zodyac/zod-mongoose cannot map
// branded types); row types re-brand to `TimeKey`.
export function timeKeyField() {
    return z
        .string()
        .regex(HOUR_MINUTE_KEY_REGEX, 'time must be HH:MM');
}

export const TimeKeySchema = timeKeyField().brand<'TimeKey'>();
export type TimeKey = z.infer<typeof TimeKeySchema>;
