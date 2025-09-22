// Currency utilities
export const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount);
};
// Date utilities
export const formatDate = (date, locale = 'en-US') => {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
};
export const formatDateTime = (date, locale = 'en-US') => {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};
// String utilities
export const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
export const slugify = (str) => {
    return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};
// Validation utilities
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
export const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};
// Array utilities
export const groupBy = (array, key) => {
    return array.reduce((groups, item) => {
        const groupKey = key(item);
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
    }, {});
};
export const sortBy = (array, key) => {
    return [...array].sort((a, b) => {
        const aVal = key(a);
        const bVal = key(b);
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });
};
// Object utilities
export const pick = (obj, keys) => {
    const result = {};
    keys.forEach((key) => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
};
export const omit = (obj, keys) => {
    const result = { ...obj };
    keys.forEach((key) => {
        delete result[key];
    });
    return result;
};
// Error handling utilities
export class AppError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 500) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
// Async utilities
export const sleep = (ms) => {
    return new Promise((resolve) => {
        if (typeof setTimeout !== 'undefined') {
            setTimeout(resolve, ms);
        }
        else {
            // Fallback for environments without setTimeout
            resolve();
        }
    });
};
export const retry = async (fn, maxAttempts = 3, delay = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
                throw lastError;
            }
            await sleep(delay * attempt);
        }
    }
    throw lastError;
};
