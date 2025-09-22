export declare const formatCurrency: (amount: number, currency?: string) => string;
export declare const formatDate: (date: Date, locale?: string) => string;
export declare const formatDateTime: (date: Date, locale?: string) => string;
export declare const capitalize: (str: string) => string;
export declare const slugify: (str: string) => string;
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidPhone: (phone: string) => boolean;
export declare const groupBy: <T, K extends string | number>(array: T[], key: (item: T) => K) => Record<K, T[]>;
export declare const sortBy: <T>(array: T[], key: (item: T) => string | number) => T[];
export declare const pick: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]) => Pick<T, K>;
export declare const omit: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]) => Omit<T, K>;
export declare class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode?: number);
}
export declare const sleep: (ms: number) => Promise<void>;
export declare const retry: <T>(fn: () => Promise<T>, maxAttempts?: number, delay?: number) => Promise<T>;
//# sourceMappingURL=index.d.ts.map