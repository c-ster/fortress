const env = import.meta.env.VITE_ENV || 'development';

export const config = {
  env,
  isDev: env === 'development',
  isTest: env === 'test',
  isProd: env === 'production',
  apiUrl: import.meta.env.VITE_API_URL || (env === 'production' ? '/api' : 'http://localhost:3001'),
} as const;
