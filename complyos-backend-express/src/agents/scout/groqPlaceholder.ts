// TODO(owner): replace with the real services/groq.ts import when it exists.
import type { ZodType } from 'zod';

export interface GroqClient {
  json<T>(schema: ZodType<T>, prompt: string, input: unknown): Promise<T>;
  getLastTokenCount?(): number | undefined;
}