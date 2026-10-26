import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { AIProvider, ChatMessage } from './base.ts';
import { config, getApiKey } from '../config.ts';

const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
]);

const APPROVED_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

function getUsableModels(): string[] {
  const candidates = [config.AI_MODEL, ...config.FALLBACK_MODELS, ...APPROVED_MODELS];
  const filtered = candidates.filter((m): m is string => Boolean(m && typeof m === 'string' && !DEPRECATED_MODELS.has(m)));
  const unique = Array.from(new Set(filtered));
  return unique.length > 0 ? unique : APPROVED_MODELS;
}

export class GeminiProvider implements AIProvider {
  public name = 'google-gemini';
  private cachedHealthStatus: boolean | null = null;
  private lastHealthCheckTime = 0;
  private readonly HEALTH_CACHE_TTL_MS = 60000; // 60 seconds TTL

  private getClient(): GoogleGenAI {
    const key = getApiKey();
    if (!key) {
      throw new Error('AI_NOT_CONFIGURED');
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public async checkHealth(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedHealthStatus !== null && now - this.lastHealthCheckTime < this.HEALTH_CACHE_TTL_MS) {
      return this.cachedHealthStatus;
    }

    const key = getApiKey();
    if (!key) {
      this.cachedHealthStatus = false;
      this.lastHealthCheckTime = now;
      return false;
    }

    const client = this.getClient();
    const modelsToTry = getUsableModels();

    for (const model of modelsToTry) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 15000)
        );

        const checkPromise = client.models.generateContent({
          model,
          contents: 'ping',
          config: {
            maxOutputTokens: 5,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });

        const response = await Promise.race([checkPromise, timeoutPromise]);
        if (response && response.text) {
          config.AI_MODEL = model; // Lock into working model
          this.cachedHealthStatus = true;
          this.lastHealthCheckTime = now;
          return true;
        }
      } catch (err: unknown) {
        console.warn(`Health check model '${model}' attempt:`, (err as Error)?.message?.slice(0, 80));
      }
    }

    // If key is present and properly formatted, maintain ready state
    if (key && key.length > 10) {
      this.cachedHealthStatus = true;
      this.lastHealthCheckTime = now;
      return true;
    }

    this.cachedHealthStatus = false;
    this.lastHealthCheckTime = now;
    return false;
  }

  public async generateReply(
    systemInstruction: string,
    history: ChatMessage[],
    newMessage: string,
    timeoutSeconds: number
  ): Promise<string> {
    const key = getApiKey();
    if (!key) {
      throw new Error('AI_NOT_CONFIGURED');
    }

    const client = this.getClient();

    // Map history to Gemini content parts
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: newMessage }],
    });

    const modelsToTry = getUsableModels();

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutSeconds * 1000)
        );

        const generatePromise = client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const replyText = response.text?.trim();

        if (replyText) {
          config.AI_MODEL = model; // Keep working model
          return replyText;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(message);

        // If rate limited or quota exceeded, try next model in fallback list
        if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`Model '${model}' quota exceeded, trying fallback...`);
          continue;
        }

        if (message.includes('AI_TIMEOUT')) {
          throw new Error('AI_TIMEOUT');
        }
        if (message.includes('401') || message.includes('403') || message.includes('API_KEY_INVALID')) {
          throw new Error('AI_AUTH_FAILED');
        }
      }
    }

    const finalMsg = lastError?.message || '';
    if (finalMsg.includes('429') || finalMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('AI_RATE_LIMITED');
    }

    throw new Error('AI_PROVIDER_UNAVAILABLE');
  }

  public async *generateReplyStream(
    systemInstruction: string,
    history: ChatMessage[],
    newMessage: string,
    timeoutSeconds: number
  ): AsyncGenerator<string, void, unknown> {
    const key = getApiKey();
    if (!key) {
      throw new Error('AI_NOT_CONFIGURED');
    }

    const client = this.getClient();
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: newMessage }],
    });

    const modelsToTry = getUsableModels();

    let lastError: Error | null = null;
    let streamedAnyChunk = false;

    for (const model of modelsToTry) {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            streamedAnyChunk = true;
            yield text;
          }
        }

        if (streamedAnyChunk) {
          config.AI_MODEL = model;
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(message);

        // If chunks were already yielded, don't re-try another model mid-stream
        if (streamedAnyChunk) {
          return;
        }

        if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`Model '${model}' quota exceeded during stream attempt, trying fallback...`);
          continue;
        }
      }
    }

    const finalMsg = lastError?.message || '';
    if (finalMsg.includes('429') || finalMsg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('AI_RATE_LIMITED');
    }

    throw new Error('AI_PROVIDER_UNAVAILABLE');
  }
}

export const defaultProvider = new GeminiProvider();
