// Environment configuration
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_TEST: process.env.NODE_ENV === 'test',
} as const

// API configuration
export const api = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
  retries: 3,
} as const

// Database configuration
export const database = {
  url: process.env.DATABASE_URL || '',
  maxConnections: 20,
  connectionTimeout: 10000,
} as const

// Authentication configuration
export const auth = {
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: '7d',
  refreshTokenExpiresIn: '30d',
  bcryptRounds: 12,
} as const

// File upload configuration
export const upload = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedDocumentTypes: ['application/pdf', 'text/plain'],
} as const

// Pagination configuration
export const pagination = {
  defaultLimit: 20,
  maxLimit: 100,
} as const

// Cache configuration
export const cache = {
  ttl: 300, // 5 minutes
  maxSize: 1000,
} as const

// Rate limiting configuration
export const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
} as const

// Logging configuration
export const logging = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
} as const

// Feature flags
export const features = {
  enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
  enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true',
  enableMaintenanceMode: process.env.ENABLE_MAINTENANCE_MODE === 'true',
} as const

// External services configuration
export const services = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
  },
  posthog: {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
  },
} as const
