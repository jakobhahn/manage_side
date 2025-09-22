export declare const env: {
    readonly NODE_ENV: string;
    readonly IS_DEVELOPMENT: boolean;
    readonly IS_PRODUCTION: boolean;
    readonly IS_TEST: boolean;
};
export declare const api: {
    readonly baseUrl: string;
    readonly timeout: 10000;
    readonly retries: 3;
};
export declare const database: {
    readonly url: string;
    readonly maxConnections: 20;
    readonly connectionTimeout: 10000;
};
export declare const auth: {
    readonly jwtSecret: string;
    readonly jwtExpiresIn: "7d";
    readonly refreshTokenExpiresIn: "30d";
    readonly bcryptRounds: 12;
};
export declare const upload: {
    readonly maxFileSize: number;
    readonly allowedImageTypes: readonly ["image/jpeg", "image/png", "image/webp"];
    readonly allowedDocumentTypes: readonly ["application/pdf", "text/plain"];
};
export declare const pagination: {
    readonly defaultLimit: 20;
    readonly maxLimit: 100;
};
export declare const cache: {
    readonly ttl: 300;
    readonly maxSize: 1000;
};
export declare const rateLimit: {
    readonly windowMs: number;
    readonly max: 100;
};
export declare const logging: {
    readonly level: string;
    readonly format: string;
};
export declare const features: {
    readonly enableAnalytics: boolean;
    readonly enableDebugMode: boolean;
    readonly enableMaintenanceMode: boolean;
};
export declare const services: {
    readonly supabase: {
        readonly url: string;
        readonly anonKey: string;
        readonly serviceKey: string;
    };
    readonly sentry: {
        readonly dsn: string;
        readonly environment: string;
    };
    readonly posthog: {
        readonly key: string;
        readonly host: string;
    };
};
//# sourceMappingURL=index.d.ts.map