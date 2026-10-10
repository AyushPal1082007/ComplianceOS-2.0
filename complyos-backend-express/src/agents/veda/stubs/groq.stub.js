// STUB
/**
 * ComplianceOS — Groq Service Adapter / Stub
 * Owned by backend lead / services owner.
 * Provides JSON completion with retry, backoff, and zod validation.
 */

import Groq from 'groq-sdk';
import config from '../../../config.js';
import logger from '../../../logger.js';

let groqInstance = null;

function getGroqClient() {
  if (!groqInstance && config.groq.apiKey) {
    groqInstance = new Groq({ apiKey: config.groq.apiKey });
  }
  return groqInstance;
}

/**
 * Call Groq chat completion in JSON mode with retry logic
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {string} [params.model]
 * @param {z.ZodTypeAny} [params.schema]
 * @param {number} [params.retries=2]
 * @returns {Promise<{ data: any, tokens: number }>}
 */
export async function completeJson({
  systemPrompt,
  userPrompt,
  model = config.groq.model || 'llama3-70b-8192',
  schema = null,
  retries = 2,
}) {
  const groq = getGroqClient();
  if (!groq) {
    throw new Error('Groq API key is not configured');
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const content = response.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      const totalTokens = response.usage?.total_tokens || 0;

      // If schema provided, validate
      if (schema) {
        const validation = schema.safeParse(parsed);
        if (!validation.success) {
          // One repair retry if validation failed and we still have attempts
          if (attempt < retries) {
            logger.warn('JSON schema mismatch from Groq, attempting repair retry', {
              errors: validation.error?.issues,
            });
            continue;
          }
          // Return parsed anyway so downstream can handle missing fields
          return { data: parsed, tokens: totalTokens };
        }
        return { data: validation.data, tokens: totalTokens };
      }

      return { data: parsed, tokens: totalTokens };
    } catch (err) {
      lastError = err;
      logger.warn(`Groq completion failed (attempt ${attempt + 1}/${retries + 1})`, {
        error: err.message,
      });

      // Exponential backoff
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('Groq JSON completion failed after retries');
}

export default {
  completeJson,
};
