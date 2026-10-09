'use strict';
/**
 * ComplianceOS — SENTINEL Agent (Scheduled Enterprise Notification and Tracking Intelligence)
 * Fetches official govt pages → hash change detection → targeted alerts
 * Per PDF: "Stored with 'last verified' date; alert only reaches right profile"
 */
import axios from 'axios';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';

import config from '../config.js';
import logger from '../logger.js';
import prisma from '../db.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

// ── Monitored Sources ─────────────────────────────────────────────────────────
// These are the pages SENTINEL crawls for changes
const MONITORED_SOURCES = [
  {
    id: 'gst_portal_updates',
    name: 'GST Portal — Latest Updates',
    url: 'https://gst.gov.in/websitepage/updatedlist',
    affectedAttributes: { sector: null, state: null, turnover: null, hasGSTIN: true },
    tags: ['gst', 'all'],
  },
  {
    id: 'cbic_circulars',
    name: 'CBIC — Recent Circulars',
    url: 'https://cbic-gst.gov.in/gst-goods-services-rates.html',
    affectedAttributes: { sector: null, state: null, turnover: null, hasGSTIN: true },
    tags: ['gst', 'rates', 'all'],
  },
  {
    id: 'msme_ministry_news',
    name: 'Ministry of MSME — Press Releases',
    url: 'https://msme.gov.in/press-release',
    affectedAttributes: { sector: null, state: null, turnover: null },
    tags: ['msme', 'schemes', 'all'],
  },
  {
    id: 'up_msme_schemes',
    name: 'UP MSME Connect — Scheme Updates',
    url: 'https://msme1connect.up.gov.in',
    affectedAttributes: { state: 'Uttar Pradesh' },
    tags: ['UP', 'schemes'],
  },
];

// ── Hash a page's content ─────────────────────────────────────────────────────

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ── Fetch page text ───────────────────────────────────────────────────────────

async function fetchPageText(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'ComplianceOS-SENTINEL/2.0 (compliance awareness bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    // Strip HTML tags for text comparison
    const text = response.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { text, hash: hashContent(text), success: true };
  } catch (err) {
    logger.warn('SENTINEL fetch failed', { url, error: err.message });
    return { text: '', hash: null, success: false };
  }
}

// ── Classify changes via Groq ─────────────────────────────────────────────────

async function classifyChange(sourceName, oldText, newText, affectedAttributes) {
  const prompt = `You are SENTINEL, a regulatory change detector for Indian MSME compliance.

Source: ${sourceName}
A change was detected. Analyze what changed and who it affects.

Sample of new content (first 2000 chars):
${newText.substring(0, 2000)}

Return JSON:
{
  "title": "Short title of the change (in Hindi)",
  "title_english": "Short title in English",
  "summary_hindi": "2-3 sentence plain Hindi summary for MSME owners",
  "affects": {
    "sectors": ["all"] or ["textile", "food", etc.],
    "states": ["all"] or ["Uttar Pradesh", etc.],
    "turnover_brackets": ["all"] or ["up to 1.5 Cr", etc.],
    "gstin_holders": true,
    "udyam_holders": true
  },
  "urgency": "high | medium | low",
  "action_required": "what the MSME owner should do",
  "source_section": "which section/notification changed",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch (err) {
    logger.warn('SENTINEL classify failed', { error: err.message });
    return null;
  }
}

// ── Send targeted alerts to affected users ────────────────────────────────────

async function sendTargetedAlerts(changeInfo, source) {
  // Build query to find affected users based on profile attributes
  const where = { user: { isActive: true } };
  
  if (source.affectedAttributes?.state) {
    where.state = { contains: source.affectedAttributes.state, mode: 'insensitive' };
  }
  if (source.affectedAttributes?.hasGSTIN) {
    where.gstin = { not: null };
  }

  const profiles = await prisma.businessProfile.findMany({
    where,
    include: { user: { select: { id: true } } },
  });

  const alerts = profiles.map(profile => ({
    id: uuidv4(),
    userId: profile.user.id,
    title: changeInfo.title || changeInfo.title_english,
    titleHindi: changeInfo.title,
    summary: changeInfo.title_english || 'Regulatory update detected',
    summaryHindi: changeInfo.summary_hindi,
    sourceUrl: source.url,
    lastVerifiedAt: new Date(),
    isSimulated: false,
    affectedAttributes: changeInfo.affects || {},
    status: 'unread',
  }));

  if (alerts.length > 0) {
    await prisma.sentinelAlert.createMany({ data: alerts });
    logger.info('SENTINEL alerts sent', { count: alerts.length, source: source.id });
  }

  return alerts.length;
}

// ── Inject a demo/simulated alert ─────────────────────────────────────────────

async function injectSimulatedAlert(userId, options = {}) {
  const alert = await prisma.sentinelAlert.create({
    data: {
      id: uuidv4(),
      userId,
      title: options.title || 'GST Filing Deadline Reminder',
      titleHindi: options.titleHindi || 'GST दाखिल करने की अंतिम तिथि की याद दिलाता है',
      summary: options.summary || 'Your GSTR-3B for last month is due on 20th. Filing late incurs ₹50/day fee.',
      summaryHindi: options.summaryHindi || 'पिछले महीने का GSTR-3B 20 तारीख को देय है। देर से दाखिल करने पर ₹50/दिन का जुर्माना लगता है।',
      sourceUrl: 'https://gst.gov.in',
      lastVerifiedAt: new Date(),
      isSimulated: true, // ← PDF: "labelled simulated alert" for demo
      affectedAttributes: { hasGSTIN: true },
      status: 'unread',
    },
  });

  return alert;
}

// ── Run full SENTINEL crawl (called by BullMQ job) ────────────────────────────

async function runSentinelCrawl() {
  logger.info('SENTINEL crawl started');
  const results = [];

  for (const source of MONITORED_SOURCES) {
    try {
      const { text: newText, hash: newHash, success } = await fetchPageText(source.url);
      if (!success) continue;

      // Get stored hash (use Redis cache or DB in production)
      // For now, store in memory — production would use Upstash Redis
      const storedHash = global.__sentinelHashCache?.[source.id];

      if (!storedHash) {
        // First run — just store the hash
        if (!global.__sentinelHashCache) global.__sentinelHashCache = {};
        global.__sentinelHashCache[source.id] = newHash;
        results.push({ sourceId: source.id, status: 'baseline_stored' });
        continue;
      }

      if (newHash !== storedHash) {
        logger.info('SENTINEL change detected', { source: source.id });
        
        // Classify the change
        const changeInfo = await classifyChange(source.name, '', newText, source.affectedAttributes);
        
        if (changeInfo && changeInfo.confidence >= config.trustLayer.confidenceGate) {
          const alertCount = await sendTargetedAlerts(changeInfo, source);
          results.push({ sourceId: source.id, status: 'change_detected', alertsSent: alertCount });
        }

        global.__sentinelHashCache[source.id] = newHash;
        
        // Rate limit Groq
        await new Promise(r => setTimeout(r, config.groq.rateLimitDelay));
      } else {
        results.push({ sourceId: source.id, status: 'no_change' });
      }
    } catch (err) {
      logger.error('SENTINEL crawl error', { source: source.id, error: err.message });
      results.push({ sourceId: source.id, status: 'error', error: err.message });
    }
  }

  logger.info('SENTINEL crawl complete', { results });
  return results;
}

export {
  runSentinelCrawl,
  injectSimulatedAlert,
  MONITORED_SOURCES,
};
export default {
  runSentinelCrawl,
  injectSimulatedAlert,
  MONITORED_SOURCES,
};
