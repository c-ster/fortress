const env = process.env.NODE_ENV || 'development';

export const config = {
  env,
  isDev: env === 'development',
  isTest: env === 'test',
  isProd: env === 'production',
  port: parseInt(process.env.PORT || '3001', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  databaseUrl:
    env === 'test'
      ? process.env.DATABASE_URL_TEST || 'postgresql://localhost:5432/fortress_test'
      : process.env.DATABASE_URL || 'postgresql://localhost:5432/fortress_dev',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  email: {
    provider: (process.env.EMAIL_PROVIDER || 'console') as 'console' | 'sendgrid' | 'ses',
    apiKey: process.env.EMAIL_API_KEY || '',
  },
  rateLimit: {
    auth: parseInt(process.env.RATE_LIMIT_AUTH || (env === 'development' ? '100' : '5'), 10),
  },
} as const;
