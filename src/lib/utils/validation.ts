import * as m from '$lib/paraglide/messages';

export function formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    try {
        let date: Date;

        // Handle LDAP Generalized Time format: YYYYMMDDHHmmssZ (e.g., 20251128115204Z)
        const ldapMatch = dateString.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);
        if (ldapMatch) {
            const [, year, month, day, hours, minutes, seconds] = ldapMatch;
            date = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds)
            ));
        } else {
            // Handle ISO 8601 format: 2025-08-27T09:05:22.403314637+00:00
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        // Format as YYYY-MM-DD HH:mm:ss in 24h format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
        return dateString;
    }
}

export function isValidEmail(email: string): boolean {
    // More comprehensive email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
}


export function sanitizeString(input: string, maxLength = 1000): string {
    if (!input) return '';
    let sanitized = input.substring(0, maxLength);
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return sanitized;
}

export function isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(username);
}

export function validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    if (password.length < 8) {
        errors.push(m.validation_password_min_length());
    }
    if (password.length > 64) {
        errors.push(m.validation_password_max_length());
    }
    if (!/[a-z]/.test(password)) {
        errors.push(m.validation_password_lowercase());
    }
    if (!/[A-Z]/.test(password)) {
        errors.push(m.validation_password_uppercase());
    }
    if (!/[0-9]/.test(password)) {
        errors.push(m.validation_password_number());
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}