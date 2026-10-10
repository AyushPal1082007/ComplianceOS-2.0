import { createHash } from 'node:crypto';
import Groq from 'groq-sdk';
import config from '../config.js';
import logger from '../logger.js';

let client;
let queue = Promise.resolve();
let lastCallAt = 0;
const cache = new Map();
const MIN_SPACING_MS = 3000;
const CACHE_LIMIT = 128;

function getClient() {
  if (!config.groq.apiKey) throw new Error('GROQ_API_KEY is not configured');
  client ||= new Groq({ apiKey: config.groq.apiKey });
  return client;
}

function cacheKey(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

async function serializedCall(params) {
  const operation = queue.then(async () => {
    const wait = MIN_SPACING_MS - (Date.now() - lastCallAt);
    if (lastCallAt && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return params();
  });
  queue = operation.catch(() => {});
  return operation;
}

async function completion(systemPrompt, userInput, maxTokens = 700, jsonMode = false) {
  return serializedCall(() => getClient().chat.completions.create({
    model: process.env.GROQ_MODEL || config.groq.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
    temperature: 0,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  }));
}

export async function json(schema, systemPrompt, userInput, options = {}) {
  const key = cacheKey([process.env.GROQ_MODEL || config.groq.model, systemPrompt, userInput]);
  if (cache.has(key)) return structuredClone(cache.get(key));
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const prompt = attempt === 0 ? systemPrompt : `${systemPrompt}\nRepair the previous JSON to match the schema. Return JSON only.`;
      const response = await completion(prompt, userInput, options.maxTokens, true);
      const raw = response.choices?.[0]?.message?.content || '{}';
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        if (attempt < 2) continue;
        throw new Error('Groq returned invalid JSON');
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        if (attempt < 2) continue;
        throw new Error('Groq JSON did not match the requested schema');
      }
      const result = { data: parsed.data, tokens: response.usage?.total_tokens || 0 };
      cache.set(key, result);
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
      return structuredClone(result);
    } catch (error) {
      lastError = error;
      const retryable = error.status === 429 || error.status >= 500 || error.code === 'ETIMEDOUT';
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
      logger.warn('Groq request retrying', { attempt: attempt + 1, status: error.status });
    }
  }
  throw lastError || new Error('Groq completion failed');
}

export async function text(systemPrompt, userInput, options = {}) {
  const response = await completion(systemPrompt, userInput, options.maxTokens || 700, false);
  return { text: response.choices?.[0]?.message?.content || '', tokens: response.usage?.total_tokens || 0 };
}

export function clearCache() {
  cache.clear();
}
