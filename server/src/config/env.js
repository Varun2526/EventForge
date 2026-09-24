import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  MONGODB_URI: z.string().min(1, { message: 'MONGODB_URI is required' }),
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters long' }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BADGE_JWT_SECRET: z.string().min(32).optional().default('eventforge_badge_hmac_secret_key_32bytes_min!'),
  OPENAI_API_KEY: z.string().optional().default(''),
  AI_PROVIDER: z.enum(['openai', 'mock']).default(process.env.OPENAI_API_KEY ? 'openai' : 'mock'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).default(process.env.STRIPE_SECRET_KEY ? 'stripe' : 'mock'),
  CLIENT_URL: z.string().default('http://localhost:5173')
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Environment validation failed. Review your .env configuration.');
  }
  return result.data;
};

export const env = parseEnv();
