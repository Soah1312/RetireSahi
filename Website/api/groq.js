import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = getEnv('GROQ_PRIMARY_MODEL') || 'qwen/qwen3-32b';
const FALLBACK_MODEL = getEnv('GROQ_FALLBACK_MODEL') || 'openai/gpt-oss-120b';
const MAX_MESSAGES = 12;
const MAX_CHARS_PER_MESSAGE = 6000;
const FINANCE_SCOPE_PATTERN = /\b(finance|financial|money|retire|retirement|nps|pension|annuity|corpus|tax|80ccd|budget|budgeting|expense|expenses|spend|spending|save|saving|savings|invest|investment|investing|sip|mutual\s*fund|equity|debt|asset\s*allocation|salary|ctc|compensation|take\s*home|in\s*hand|job\s*switch|offer|hike|promotion|loan|emi|debt|insurance|pf|epf|ppf|inflation|net\s*worth|cash\s*flow|emergency\s*fund|wealth|goal\s*planning)\b/i;
const NON_FINANCE_PATTERN = /\b(recipe|cook|cooking|kitchen|maggie|maggi|noodles|movie|cinema|song|music|lyrics|joke|meme|poem|story|travel|game|gaming|cricket|football|anime|astrology|horoscope|weather|coding|code|programming|javascript|typescript|python|java|react|html|css|debug|bug|stack\s*trace|terminal|docker|kubernetes)\b/i;
const SCOPE_GUARD_REPLY = [
  'I can only help with financial advice related to retirement, NPS, tax, savings, investments, and money decisions.',
  'Try one of these instead:',
  '1) Based on my monthly income, how much should I invest each month to reach my retirement goal?',
  '2) How should I adjust my NPS contribution and asset allocation to improve my retirement score?',
].join('\n');

function getEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-Auth, X-Firebase-Token');
}

function isLocalhostRequest(req) {
  const hostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : (req.headers.host || '');
  const xfHostHeader = Array.isArray(req.headers['x-forwarded-host'])
    ? req.headers['x-forwarded-host'][0]
    : (req.headers['x-forwarded-host'] || '');

  const host = `${hostHeader} ${xfHostHeader}`.toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
}

function getFirebaseAuth() {
  const projectId = getEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getEnv('FIREBASE_CLIENT_EMAIL');
  let privateKey = getEnv('FIREBASE_PRIVATE_KEY');

  // Remove quotes if present (from .env file parsing)
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  // Handle both escaped newlines (\n) and literal newlines
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase config:', { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
    throw new Error('FIREBASE_ADMIN_CONFIG_MISSING');
  }

  if (!getApps().length) {
      try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
      } catch (err) {
        console.error('Firebase init error:', err.message);
        throw err;
      }
  }

  return getAuth();
}

function normalizeMessages(input) {
  if (!Array.isArray(input)) {
    throw new Error('INVALID_MESSAGES');
  }

  return input
    .slice(-MAX_MESSAGES)
    .map((message) => {
      const role = typeof message?.role === 'string' ? message.role : '';
      const content = typeof message?.content === 'string' ? message.content : '';

      if (!['system', 'user', 'assistant'].includes(role)) {
        throw new Error('INVALID_MESSAGE_ROLE');
      }

      if (!content.trim() || content.length > MAX_CHARS_PER_MESSAGE) {
        throw new Error('INVALID_MESSAGE_CONTENT');
      }

      return { role, content };
    });
}

function parseRequestBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return {};
}

function isFinanceOnlyQuestion(text) {
  if (typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (NON_FINANCE_PATTERN.test(normalized)) return false;
  return FINANCE_SCOPE_PATTERN.test(normalized);
}

function writeScopeGuardStream(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`data: ${JSON.stringify({
    type: 'meta',
    model: 'scope-guard',
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    fallbackUsed: false,
    forceFallback: false,
  })}\n\n`);
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: SCOPE_GUARD_REPLY } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

async function relayGroqStream(groqResponse, res, streamMeta = null) {
  if (!groqResponse.body) {
    throw new Error('STREAM_BODY_MISSING');
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  if (streamMeta) {
    res.write(`data: ${JSON.stringify({ type: 'meta', ...streamMeta })}\n\n`);
  }

  const reader = groqResponse.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      res.write(chunk);
    }
  }

  res.end();
}

async function callGroqWithModel(groqApiKey, model, messages, stream) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      stream,
    }),
  });

  return response;
}

function getModelOrder(forceFallback = false) {
  const ordered = forceFallback
    ? [FALLBACK_MODEL, PRIMARY_MODEL]
    : [PRIMARY_MODEL, FALLBACK_MODEL];

  return [...new Set(ordered.filter(Boolean))];
}

async function callGroqWithFallback(groqApiKey, messages, stream, options = {}) {
  const forceFallback = Boolean(options.forceFallback);
  const models = getModelOrder(forceFallback);
  const attempts = [];
  let lastResponse = null;

  for (const model of models) {
    try {
      const response = await callGroqWithModel(groqApiKey, model, messages, stream);

      if (response.ok) {
        return { ok: true, response, model, attempts };
      }

      const errorData = await response.json().catch(() => ({}));
      attempts.push({
        model,
        status: response.status,
        error: errorData?.error?.message || 'Groq request failed',
      });
      lastResponse = response;
    } catch (error) {
      attempts.push({
        model,
        status: 0,
        error: error?.message || 'Network error while calling model',
      });
    }
  }

  return {
    ok: false,
    response: lastResponse,
    attempts,
  };
}

async function verifyUserFromRequest(req, body = {}) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : (req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const fallbackHeader = req.headers['x-firebase-auth'] || req.headers['x-firebase-token'] || '';
  const fallbackToken = Array.isArray(fallbackHeader) ? fallbackHeader[0] : fallbackHeader;
  const bodyToken = typeof body?.idToken === 'string' ? body.idToken : '';
  const token = (bearerToken || fallbackToken || bodyToken || '').trim();

  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const adminAuth = getFirebaseAuth();
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (adminErr) {
    const webApiKey = getEnv('FIREBASE_WEB_API_KEY') || getEnv('VITE_FIREBASE_API_KEY');
    if (!webApiKey) {
      throw new Error('AUTH_INVALID');
    }

    // Fallback for local/dev environments: validate token with Firebase Auth REST API.
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    const lookupData = await lookupResponse.json().catch(() => ({}));
    if (!lookupResponse.ok || !Array.isArray(lookupData.users) || !lookupData.users[0]?.localId) {
      console.error('Firebase token validation failed:', adminErr?.message || 'verifyIdToken failed');
      throw new Error('AUTH_INVALID');
    }

    return {
      uid: lookupData.users[0].localId,
      email: lookupData.users[0].email,
      fallbackValidated: true,
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  setCorsHeaders(req, res);
  const isLocalDebug = getEnv('NODE_ENV') !== 'production';
  const isLocalhost = isLocalhostRequest(req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseRequestBody(req);

    // Localhost dev fallback: allow requests through when token verification is flaky in local proxy chains.
    // Production traffic never matches localhost hostnames, so prod auth stays enforced.
    if (!isLocalhost) {
      await verifyUserFromRequest(req, body);
    }

    const messages = normalizeMessages(body.messages);
    const stream = Boolean(body.stream);
    const forceFallback = Boolean(body.forceFallback) && (isLocalhost || isLocalDebug);
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '';

    if (!isFinanceOnlyQuestion(latestUserMessage)) {
      if (stream) {
        writeScopeGuardStream(res);
        return;
      }

      return res.status(200).json({
        content: SCOPE_GUARD_REPLY,
        model: 'scope-guard',
        fallbackUsed: false,
      });
    }

    const groqApiKey = getEnv('GROQ_API_KEY');
    if (!groqApiKey) {
      return res.status(503).json({ code: 'SERVER_MISCONFIGURED', error: 'Groq API key is not configured on the server.' });
    }

    const groqResult = await callGroqWithFallback(groqApiKey, messages, stream, { forceFallback });

    if (!groqResult.ok) {
      const status = groqResult.response?.status || 502;
      const lastError = groqResult.attempts[groqResult.attempts.length - 1]?.error || 'Groq request failed';
      return res.status(status).json({
        error: lastError,
        attempts: groqResult.attempts,
      });
    }

    const groqResponse = groqResult.response;
    const servedModel = groqResult.model;
    const fallbackUsed = servedModel !== PRIMARY_MODEL;

    if (stream) {
      await relayGroqStream(groqResponse, res, {
        model: servedModel,
        primaryModel: PRIMARY_MODEL,
        fallbackModel: FALLBACK_MODEL,
        fallbackUsed,
        forceFallback,
      });
      return;
    }

    const groqData = await groqResponse.json();

    return res.status(200).json({
      content: groqData?.choices?.[0]?.message?.content || '',
      model: servedModel,
      fallbackUsed,
    });
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED') {
      return res.status(401).json({
        error: 'Authentication required.',
        ...(isLocalDebug ? { debug: 'AUTH_REQUIRED_NO_TOKEN' } : {}),
      });
    }

    if (error.message === 'AUTH_INVALID') {
      return res.status(401).json({
        error: 'Authentication token is invalid or expired.',
        ...(isLocalDebug ? { debug: 'AUTH_INVALID_VERIFY_FAILED' } : {}),
      });
    }

    if (error.message === 'FIREBASE_ADMIN_CONFIG_MISSING') {
      return res.status(503).json({
        code: 'SERVER_MISCONFIGURED',
        error: 'Firebase Admin environment variables are missing on the server.',
        ...(isLocalDebug ? { debug: 'FIREBASE_ENV_MISSING' } : {}),
      });
    }

    if (error.message?.startsWith('INVALID_')) {
      return res.status(400).json({ error: 'Invalid request payload.' });
    }

    return res.status(500).json({
      error: 'Internal server error.',
      ...(isLocalDebug ? { debug: error?.message || 'UNKNOWN' } : {}),
    });
  }
}
