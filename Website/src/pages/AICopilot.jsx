import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles, Send, AlertCircle, RefreshCcw, ExternalLink, Cpu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  formatIndian,
  calculateRetirement,
  getScoreBand
} from '../utils/math';
import DashboardLayout from '../components/DashboardLayout';
import { useUser } from '../components/UserContext';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import AIPrivacyChoice from '../components/AIPrivacyChoice';
import { GROQ_PRIVACY_MODE_FIELDS, GROQ_FULL_MODE_FIELDS } from '../utils/encryption';

const AI_ENDPOINT = '/api/groq';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = import.meta.env.VITE_GROQ_PRIMARY_MODEL || 'qwen-2.5-32b';
const FALLBACK_MODEL = import.meta.env.VITE_GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile';
const USE_DIRECT_GROQ_DEV = import.meta.env.DEV && !!GROQ_API_KEY;
const ASSISTANT_PLACEHOLDER_STAGES = [
  'Thinking...',
  'Reading your profile...',
  'Drafting your answer...',
];

const formatModelTag = (model) => `[${model || 'unknown-model'}]`;

function sanitizeAssistantContent(content) {
  if (typeof content !== 'string') return '';

  let sanitized = content;
  // Remove completed think blocks first.
  sanitized = sanitized.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // If a think block starts but never closes, drop everything from its start.
  const lastOpenThink = sanitized.toLowerCase().lastIndexOf('<think>');
  if (lastOpenThink !== -1) {
    sanitized = sanitized.slice(0, lastOpenThink);
  }

  sanitized = sanitized.replace(/<\/think>/gi, '');
  return sanitized.trimStart();
}

const markdownComponents = {
  p: (props) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-black text-[#1E293B]" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  ul: (props) => <ul className="my-3 ml-5 list-disc space-y-1" {...props} />,
  ol: (props) => <ol className="my-3 ml-5 list-decimal space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: (props) => <h1 className="mt-5 mb-3 text-2xl font-black" {...props} />,
  h2: (props) => <h2 className="mt-4 mb-2 text-xl font-black" {...props} />,
  h3: (props) => <h3 className="mt-3 mb-2 text-lg font-bold" {...props} />,
  a: (props) => <a className="text-[#8B5CF6] underline decoration-2 underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
  blockquote: (props) => <blockquote className="my-4 border-l-4 border-[#F472B6] pl-4 italic text-slate-600" {...props} />,
  code: ({ inline, children, ...props }) => (
    inline ? (
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-[#1E293B]" {...props}>
        {children}
      </code>
    ) : (
      <code className="block overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100" {...props}>
        {children}
      </code>
    )
  ),
  pre: (props) => <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-0" {...props} />,
  table: (props) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-slate-100" {...props} />,
  th: (props) => <th className="border-b border-slate-200 px-3 py-2 text-left font-black text-[#1E293B]" {...props} />,
  td: (props) => <td className="border-b border-slate-100 px-3 py-2 align-top" {...props} />,
  hr: (props) => <hr className="my-4 border-slate-200" {...props} />,
};

async function streamGroq({ messages, onChunk, onDone, onError, onMeta, forceFallback = false }) {
  let response;

  if (USE_DIRECT_GROQ_DEV) {
    const orderedModels = forceFallback
      ? [FALLBACK_MODEL, PRIMARY_MODEL]
      : [PRIMARY_MODEL, FALLBACK_MODEL];
    const models = [...new Set(orderedModels.filter(Boolean))];
    let lastError = null;
    let selectedModel = null;

    for (const model of models) {
      response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
          stream: true,
        }),
      });

      if (response.ok) {
        selectedModel = model;
        break;
      }

      const error = await response.json().catch(() => ({}));
      lastError = error.error?.message || `Model ${model} failed`;
    }

    if (!response?.ok) {
      onError(lastError || 'Stream failed');
      return;
    }

    onMeta?.({
      type: 'meta',
      model: selectedModel,
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      fallbackUsed: selectedModel !== PRIMARY_MODEL,
      forceFallback,
    });
  } else {
    if (!auth.currentUser) {
      throw new Error('AUTH_REQUIRED');
    }

    const idToken = await auth.currentUser.getIdToken();
    response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-firebase-auth': idToken,
      },
      body: JSON.stringify({
        messages,
        idToken,
        stream: true,
        forceFallback,
      }),
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    onError(error.error?.message || 'Stream failed');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        onDone();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          onError(parsed.error.message || 'Stream error');
          return;
        }
        if (parsed?.type === 'meta') {
          onMeta?.(parsed);
          continue;
        }
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch {
        // Skip malformed chunks
      }
    }
  }

  onDone();
}

const QuickPrompt = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="touch-target bg-white border-2 border-[#1E293B] rounded-2xl sm:rounded-full px-4 sm:px-6 py-3 text-xs md:text-sm font-black uppercase tracking-widest pop-shadow hover:bg-[#8B5CF6] hover:text-white transition-all cursor-pointer text-left max-w-full whitespace-normal"
  >
    {text}
  </button>
);

const MessageBubble = ({ role, content, timestamp, model, fallbackUsed }) => {
  const isAI = role === 'assistant' || role === 'system';
  const renderedContent = isAI ? sanitizeAssistantContent(content ?? '') : (content ?? '');

  return (
    <div className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`text-[9px] font-black uppercase tracking-widest text-slate-400 ${!isAI && 'text-right w-full'}`}>
          {isAI ? `RetireSahi AI ${formatModelTag(model)}` : 'You'}{isAI && fallbackUsed ? ' [fallback]' : ''} • {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div
        className={`max-w-[85%] md:max-w-[75%] p-4 border-2 border-[#1E293B] pop-shadow relative ${isAI
          ? 'bg-white rounded-[18px_18px_18px_4px]'
          : 'bg-[#8B5CF6] text-white rounded-[18px_18px_4px_18px]'
          }`}
      >
        {isAI ? (
          <div className="text-sm md:text-base leading-relaxed text-[#1E293B]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {renderedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap font-bold text-white">
            {content}
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingBubble = ({ statusText }) => (
  <div className="flex flex-col items-start">
    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">RetireSahi AI • {statusText}</div>
    <div className="bg-white border-2 border-[#1E293B] rounded-[18px_18px_18px_4px] p-4 pop-shadow flex gap-1.5">
      <div className="w-2 h-2 bg-[#F472B6] rounded-full animate-[dotPulse_1s_infinite_0ms]" />
      <div className="w-2 h-2 bg-[#F472B6] rounded-full animate-[dotPulse_1s_infinite_200ms]" />
      <div className="w-2 h-2 bg-[#F472B6] rounded-full animate-[dotPulse_1s_infinite_400ms]" />
    </div>
    <style>{`
      @keyframes dotPulse {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
    `}</style>
  </div>
);

const StreamingBubble = ({ content, streamMeta }) => (
  <div className="flex flex-col items-start">
    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
      RetireSahi AI {formatModelTag(streamMeta?.model)}{streamMeta?.fallbackUsed ? ' [fallback]' : ''} • typing...
    </div>
    <div
      className="max-w-[85%] md:max-w-[75%] p-4 border-2 border-[#1E293B] pop-shadow bg-white"
      style={{ borderRadius: '18px 18px 18px 4px' }}
    >
      <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
        {content}
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: '1.1em',
            background: '#8B5CF6',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'blink 1s step-end infinite',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
);

const ChatInterface = () => {
  const { userData, setUserData } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMeta, setStreamingMeta] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [assistantPlaceholderStageIndex, setAssistantPlaceholderStageIndex] = useState(0);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const streamChunkCounterRef = useRef(0);
  const pendingScrollFrameRef = useRef(null);

  const location = useLocation();
  const hasTriggeredInitial = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (pendingScrollFrameRef.current) {
        cancelAnimationFrame(pendingScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const shouldShowPlaceholder = (isLoading || isStreaming) && !streamingContent;
    if (!shouldShowPlaceholder) {
      setAssistantPlaceholderStageIndex(0);
      return;
    }

    setAssistantPlaceholderStageIndex(0);
    const intervalId = setInterval(() => {
      setAssistantPlaceholderStageIndex((prev) => {
        if (prev >= ASSISTANT_PLACEHOLDER_STAGES.length - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, 900);

    return () => {
      clearInterval(intervalId);
    };
  }, [isLoading, isStreaming, streamingContent]);

  const scheduleStreamScroll = useCallback(() => {
    if (pendingScrollFrameRef.current) return;

    pendingScrollFrameRef.current = requestAnimationFrame(() => {
      pendingScrollFrameRef.current = null;
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' });
      }
    });
  }, []);

  const displayData = useMemo(() => {
    if (!userData) return null;
    const merged = { ...userData, ...calculateRetirement(userData) };
    if (!merged.lumpSumCorpus) merged.lumpSumCorpus = merged.projectedValue * 0.6;
    if (!merged.monthlyAnnuityIncome) merged.monthlyAnnuityIncome = (merged.projectedValue * 0.4 * 0.06) / 12;
    if (!merged.blendedReturn) {
      const eq = (merged.npsEquity || 50) / 100;
      merged.blendedReturn = (eq * 0.1269) + ((1 - eq) / 2 * 0.0887) + ((1 - eq) / 2 * 0.0874);
    }
    return merged;
  }, [userData]);

  const handlePrivacySelect = useCallback(async (mode) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    await setDoc(
      doc(db, 'users', currentUser.uid),
      { aiPrivacyMode: mode, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    setUserData((prev) => ({ ...(prev || {}), aiPrivacyMode: mode }));
  }, [setUserData]);

  const privacyMode = userData?.aiPrivacyMode || 'privacy';
  const isFullMode = privacyMode === 'full';

  const quickPrompts = displayData
    ? [
      `My score is ${displayData.score}. How do I get to 100?`,
      `Should I switch to ${displayData.taxRegime === 'new' ? 'old' : 'new'} tax regime?`,
      `What happens to my \u20B9${formatIndian(displayData.projectedValue)} at age ${displayData.retireAge}?`,
      `How does a job change affect my NPS?`,
    ]
    : [
      "How do I improve my retirement score?",
      "Should I switch tax regimes?",
      "What happens to my NPS at 60?",
      "How does a job change affect my NPS?",
    ];

  const handleSend = useCallback(async (content) => {
    if (!displayData) return;
    const rawText = typeof content === 'string' ? content : inputValue;
    if (!rawText.trim()) return;

    const fallbackCommandMatch = rawText.trim().match(/^\/fallback\b\s*/i);
    const forceFallback = Boolean(fallbackCommandMatch);
    const text = forceFallback
      ? rawText.trim().replace(/^\/fallback\b\s*/i, '').trim()
      : rawText;

    if (!text.trim()) {
      setError('Add a question after /fallback to run a fallback test.');
      return;
    }

    const userMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAssistantPlaceholderStageIndex(0);
    setIsLoading(true);
    setError(null);

    const scoreBandInfo = getScoreBand(displayData.score);
    const scoreBand = scoreBandInfo.label;

    const maxEquityPct = displayData.age < 50
      ? 75
      : Math.max(50, 75 - (displayData.age - 50) * 2.5);

    const yearsToRetire = displayData.retireAge - displayData.age;
    const annualIncome = (Number(displayData.monthlyIncome) || 0) * 12;
    const basicSalary = annualIncome * (displayData.workContext === 'Government' ? 0.50 : 0.40);

    const selectedFields = isFullMode ? GROQ_FULL_MODE_FIELDS : GROQ_PRIVACY_MODE_FIELDS;
    const selectedProfile = Object.fromEntries(
      selectedFields.map((field) => [field, displayData[field]])
    );

    const computedContext = `
RETIREMENT INSIGHTS (computed from encrypted data):
- Score: ${displayData.score}/100 (${scoreBand})
- Monthly gap to close: ${formatIndian(displayData.monthlyGap)}/month
- Projected corpus at ${displayData.retireAge}: ${formatIndian(displayData.projectedValue)}
- Required corpus: ${formatIndian(displayData.requiredCorpus)}
- Retirement gap: ${formatIndian(displayData.gap)}
- Monthly need at retirement: ${formatIndian(displayData.monthlySpendAtRetirement)}
- Lump sum at ${displayData.retireAge}: ${formatIndian(displayData.lumpSumCorpus)}
- Monthly annuity pension: ${formatIndian(displayData.monthlyAnnuityIncome)}
- Blended return: ${((displayData.blendedReturn || 0) * 100).toFixed(2)}%
`;

    const rawContext = isFullMode
      ? `
RAW FINANCIAL PROFILE (user consented to share):
- Monthly income: ₹${Number(displayData.monthlyIncome || 0).toLocaleString('en-IN')}
- Monthly NPS contribution: ₹${Number(displayData.npsContribution || 0).toLocaleString('en-IN')}
- Current NPS corpus: ₹${Number(displayData.npsCorpus || 0).toLocaleString('en-IN')}
- Other savings: ₹${Number(displayData.totalSavings || 0).toLocaleString('en-IN')}
`
      : `
NOTE: User is in Privacy Mode. Do NOT ask for or reference specific
income/corpus/contribution amounts. Use only the computed insights above.
When giving contribution advice, say amounts like "increase by Rs18K/month"
not "increase from RsX to RsY" since you do not know the base amount.
`;

    const systemPrompt = `
You are RetireSahi AI — a financial co-pilot for Indian NPS subscribers.
You are speaking with ${displayData.firstName}.
Privacy mode: ${privacyMode.toUpperCase()}
Current year: ${new Date().getFullYear()}

PROFILE:
- Age: ${displayData.age} | Retiring at: ${displayData.retireAge}
- Years to retire: ${yearsToRetire}
- Sector: ${displayData.workContext}
- Lifestyle: ${displayData.lifestyle}
- Tax regime: ${displayData.taxRegime || 'New Regime'}
- Equity allocation: ${displayData.npsEquity}%
- Max equity cap by age: ${maxEquityPct}%
${isFullMode ? `- Estimated annual income: ₹${annualIncome.toLocaleString('en-IN')}` : ''}
${isFullMode ? `- Estimated basic salary: ₹${basicSalary.toLocaleString('en-IN')}` : ''}

SELECTED PROFILE FIELDS:
${JSON.stringify(selectedProfile)}

${computedContext}
${rawContext}

NPS RULES: equity cap max 75% under 50 tapering 2.5%/year to 50% at 60.
At 60: 40% annuitized minimum 60% lump sum tax-free.
80CCD(1) old regime only 10% basic private 14% govt max 1.5L.
80CCD(1B) old regime only extra 50000. 80CCD(2) both regimes.
New regime 87A rebate zero tax if income under 12L.

SCOPE: Answer NPS retirement tax career-affecting-NPS questions only.
For off-topic questions pivot to one insight from their profile.
Never answer coding recipes stocks crypto medical legal questions.

STYLE: Warm direct concise. Use Indian formatting Lakh Crore.
Always use ${displayData.firstName}'s actual computed numbers.
3-5 sentences for simple questions max 8-10 lines for complex.
Never output hidden reasoning, chain-of-thought, or tags like <think>.
`;

    const chatHistory = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: "user", content: text }
    ];

    try {
      setIsStreaming(true);
      setStreamingContent('');
      setStreamingMeta(null);
      let fullContent = '';
      let currentMeta = null;

      await streamGroq(
        {
          messages: chatHistory,
          forceFallback,
          onChunk: (chunk) => {
          if (isLoading) setIsLoading(false);
          fullContent += chunk;
          setStreamingContent(sanitizeAssistantContent(fullContent));
          streamChunkCounterRef.current += 1;
          if (streamChunkCounterRef.current % 5 === 0 || chunk.includes('\n')) {
            scheduleStreamScroll();
          }
        },
          onMeta: (meta) => {
            currentMeta = meta;
            setStreamingMeta(meta);
          },
          onDone: () => {
          const finalContent = sanitizeAssistantContent(fullContent);
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: finalContent,
            model: currentMeta?.model || null,
            fallbackUsed: Boolean(currentMeta?.fallbackUsed),
            timestamp: new Date(),
          }]);
          streamChunkCounterRef.current = 0;
          setStreamingContent('');
          setStreamingMeta(null);
          setIsStreaming(false);
        },
          onError: (errMsg) => {
          setError(errMsg);
          streamChunkCounterRef.current = 0;
          setStreamingContent('');
          setStreamingMeta(null);
          setIsStreaming(false);
          },
        }
      );
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setStreamingContent('');
      setStreamingMeta(null);
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, [displayData, inputValue, messages, privacyMode, isFullMode, isLoading, scheduleStreamScroll]);

  useEffect(() => {
    if (userData && location.state?.initialPrompt && !hasTriggeredInitial.current) {
      hasTriggeredInitial.current = true;
      const prompt = location.state.initialPrompt;
      // Clear location state to prevent re-triggering on refresh
      window.history.replaceState({}, document.title);
      handleSend(prompt);
    }
  }, [userData, location.state, handleSend]);

  if (!userData) return null;

  if (userData.aiPrivacyMode === undefined || userData.aiPrivacyMode === null) {
    return <AIPrivacyChoice onSelect={handlePrivacySelect} firstName={userData.firstName} />;
  }

  const showAssistantPlaceholder = (isLoading || isStreaming) && !streamingContent;

  return (
    <div className="h-[calc(100dvh-64px)] lg:h-[calc(100vh-64px)] flex flex-col relative overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mobile-scroll-lock p-3 sm:p-4 md:p-8 space-y-6 sm:space-y-8 pb-[13.5rem] lg:pb-60"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto space-y-6 sm:space-y-8 animate-fade-in text-center px-1 sm:px-4">
            <div className="w-24 h-24 rounded-full border-4 border-[#1E293B] bg-white flex items-center justify-center pop-shadow animate-bounce">
              <Sparkles className="w-12 h-12 text-[#F472B6]" strokeWidth={2.5} />
            </div>
            <div className="space-y-3">
              <h2 className="font-heading font-black text-3xl md:text-4xl text-[#1E293B]">RetireSahi AI Co-Pilot</h2>
              <p className="text-base md:text-lg font-bold text-[#1E293B]/50 uppercase tracking-widest leading-tight">
                Hey {userData.firstName}! I'm optimized for lightning speed. Ask me anything.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
              {quickPrompts.map((txt, i) => (
                <QuickPrompt key={i} text={txt} onClick={handleSend} />
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full space-y-8">
            {messages.map((m, i) => (
              <MessageBubble key={m.id || i} {...m} />
            ))}
            {isStreaming && streamingContent
              ? <StreamingBubble content={streamingContent} streamMeta={streamingMeta} />
              : showAssistantPlaceholder
                ? <LoadingBubble statusText={ASSISTANT_PLACEHOLDER_STAGES[assistantPlaceholderStageIndex]} />
                : null}
            {error && (
              <div className="flex flex-col items-start max-w-xl">
                <div className="bg-white border-4 border-[#1E293B] p-6 pop-shadow-pink space-y-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-[#F472B6]" strokeWidth={3} />
                    <p className="text-sm font-bold text-[#1E293B] uppercase tracking-widest">Houston, we have a problem</p>
                  </div>

                  {error === 'AI_BACKEND_NOT_CONFIGURED' ? (
                    <div className="space-y-4">
                      <p className="text-sm font-bold text-[#1E293B]/70 leading-relaxed">
                        The AI server is not configured yet. Add <code className="bg-slate-100 px-1 rounded">GROQ_API_KEY</code> and Firebase Admin env vars in Vercel, then redeploy.
                      </p>
                      <a
                        href="https://vercel.com/docs/environment-variables"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8B5CF6] hover:underline"
                      >
                        Open env var docs <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : error === 'AUTH_REQUIRED' ? (
                    <p className="text-sm font-bold text-[#1E293B]/70 leading-relaxed">
                      Your session expired. Please sign in again and retry.
                    </p>
                  ) : error === 'RATE_LIMIT' ? (
                    <p className="text-sm font-bold text-[#1E293B]/70 leading-relaxed">
                      Too many AI requests right now. Please wait a moment and try again.
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-slate-500">{error}</p>
                  )}

                  <button
                    onClick={() => handleSend(messages[messages.length - 1]?.content)}
                    className="flex items-center gap-2 px-6 py-2 bg-[#F472B6] text-white rounded-full font-black uppercase tracking-widest text-xs pop-shadow hover:-translate-y-1 transition-all"
                  >
                    <RefreshCcw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              </div>
            )}
            <div className="h-28 lg:h-20" />
          </div>
        )}
      </div>

      <div className="absolute left-0 right-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 p-3 sm:p-4 md:p-8 bg-gradient-to-t from-[#FFFDF5] via-[#FFFDF5] to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto">
          <div className="bg-white border-2 border-[#1E293B] rounded-2xl sm:rounded-full p-2 sm:p-2.5 pl-4 sm:pl-6 md:p-3 md:pl-8 flex items-center gap-3 sm:gap-4 pop-shadow relative">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent border-none outline-none text-sm md:text-lg font-bold text-[#1E293B] placeholder-slate-300"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || isStreaming || !inputValue.trim()}
              className="touch-target w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#34D399] border-2 border-[#1E293B] flex items-center justify-center text-white pop-shadow transition-all hover:-translate-y-1 hover:translate-x-[-1px] disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isLoading ? (
                <Cpu className="w-5 h-5 md:w-6 md:h-6 animate-spin text-[#1E293B]" strokeWidth={3} />
              ) : (
                <Send className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[#1E293B]" strokeWidth={3} />
              )}
            </button>
          </div>
          <div className="mt-2 px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#1E293B]/40">
            Testing tip: use /fallback before your prompt to force Llama fallback on localhost/dev.
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AICopilot() {
  return (
    <DashboardLayout title="AI Co-Pilot">
      <ChatInterface />
    </DashboardLayout>
  );
}
