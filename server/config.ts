import dotenv from 'dotenv';
dotenv.config();

const rawModel = process.env.AI_MODEL || 'gemini-3.8-flash';
const DEPRECATED_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-2.0-flash-thinking', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
const safeAiModel = DEPRECATED_MODELS.includes(rawModel) ? 'gemini-3.8-flash' : rawModel;

export const config = {
  APP_NAME: process.env.APP_NAME || 'EDITH',
  APP_ENV: process.env.APP_ENV || process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'sqlite:///./edith.db',
  AI_PROVIDER: process.env.AI_PROVIDER || 'google-gemini',
  AI_MODEL: safeAiModel,
  FALLBACK_MODELS: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
  AI_BASE_URL: process.env.AI_BASE_URL || '',
  AI_TIMEOUT_SECONDS: parseInt(process.env.AI_TIMEOUT_SECONDS || '30', 10),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000').split(','),
  MAX_MESSAGE_CHARS: parseInt(process.env.MAX_MESSAGE_CHARS || '4000', 10),
  MAX_CONTEXT_MESSAGES: parseInt(process.env.MAX_CONTEXT_MESSAGES || '20', 10),
  MAX_CONTEXT_CHARS: parseInt(process.env.MAX_CONTEXT_CHARS || '12000', 10),
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '30', 10),
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '127.0.0.1',
  BRIDGE_TOKEN: process.env.EDITH_BRIDGE_TOKEN || '',
};

export function getApiKey(): string | undefined {
  const rawKey =
    process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY;
  return rawKey ? rawKey.trim() : undefined;
}

export function isAiConfigured(): boolean {
  const key = getApiKey();
  return Boolean(key && key.length > 0 && config.AI_MODEL);
}
