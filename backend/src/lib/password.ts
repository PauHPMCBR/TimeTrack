import { PasswordIncorrectParameterReason } from 'shared/src/types/response-errors';

/**
 * Validates a candidate password against the app's policy and returns the list
 * of failed rules (empty = valid). Shared by the register and reset flows.
 */
export function validatePassword(
    password: string,
    email: string,
    name: string
): PasswordIncorrectParameterReason[] {
    const pwd = String(password);
    const errors: PasswordIncorrectParameterReason[] = [];

    if (pwd.length < 8) {
        errors.push('TooShort');
    }
    if (!/[a-z]/.test(pwd)) {
        errors.push('MissingLowercase');
    }
    if (!/[A-Z]/.test(pwd)) {
        errors.push('MissingUppercase');
    }
    if (!/\d/.test(pwd)) {
        errors.push('MissingNumber');
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
        errors.push('MissingSign');
    }

    const lowerPwd = pwd.toLowerCase();
    const lowerEmail = String(email || '').toLowerCase();
    const lowerName = String(name || '').toLowerCase();

    if (lowerPwd.includes(lowerEmail) && lowerEmail.length > 0) {
        errors.push('ContainsEmail');
    }
    if (lowerPwd.includes(lowerName) && lowerName.length > 0) {
        errors.push('ContainsUsername');
    }

    return errors;
}