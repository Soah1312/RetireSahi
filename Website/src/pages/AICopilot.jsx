import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Bot, User, Trash2, ArrowRight, Zap, Target,
  HelpCircle, AlertCircle, RefreshCcw, ExternalLink, Cpu
} from 'lucide-react';
import { formatIndian, calculateRetirement } from '../utils/math';
import DashboardLayout, { useUser } from '../components/DashboardLayout';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile"; // High performance free model

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error('MISSING_KEY');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('Groq API Error:', data.error);
    throw new Error(data.error.message);
  }

  return data.choices[0].message.content;
}

const QuickPrompt = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="bg-white border-2 border-[#1E293B] rounded-full px-6 py-3 text-xs md:text-sm font-black uppercase tracking-widest pop-shadow hover:bg-[#8B5CF6] hover:text-white transition-all cursor-pointer text-left truncate max-w-full"
  >
    {text}
  </button>
);

const MessageBubble = ({ role, content, timestamp }) => {
  const isAI = role === 'assistant' || role === 'system';
  return (
    <div className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`text-[9px] font-black uppercase tracking-widest text-slate-400 ${!isAI && 'text-right w-full'}`}>
          {isAI ? 'Pulse AI (Groq)' : 'You'} • {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div
        className={`max-w-[85%] md:max-w-[75%] p-4 border-2 border-[#1E293B] pop-shadow relative ${isAI
          ? 'bg-white rounded-[18px_18px_18px_4px]'
          : 'bg-[#8B5CF6] text-white rounded-[18px_18px_4px_18px]'
          }`}
      >
        <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap ${!isAI && 'font-bold'}`}>
          {content}
        </div>
      </div>
    </div>
  );
};

const LoadingBubble = () => (
  <div className="flex flex-col items-start">
    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Pulse AI is computing...</div>
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
    `}</style>
  </div>
);

const ChatInterface = () => {
  const { userData } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (userData) {
      localStorage.setItem('nps_pulse_user_data', JSON.stringify(userData));
    }
  }, [userData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!userData) return null;

  const displayData = userData.score !== undefined ? userData : { ...userData, ...calculateRetirement(userData) };

  const handleSend = async (content) => {
    const text = typeof content === 'string' ? content : inputValue;
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    const scoreBand = displayData.score <= 30 ? 'Critical' : displayData.score <= 50 ? 'At Risk' : displayData.score <= 70 ? 'On Track' : displayData.score <= 85 ? 'Good' : 'Excellent';

    const systemPrompt = `
      You are NPS Pulse AI — a friendly, knowledge-heavy financial advisor for Indians using NPS. 
      You are talking to ${displayData.firstName}.
      
      USER CONTEXT:
      - Age: ${displayData.age}, Retire at: ${displayData.retireAge}
      - Score: ${displayData.score}/100 (${scoreBand})
      - Monthly Income: ₹${displayData.monthlyIncome}
      - Projected NPS Corpus: ₹${formatIndian(displayData.projectedValue)}
      - Monthly Retirement Need: ₹${formatIndian(displayData.monthlySpendAtRetirement)}
      - Sector: ${displayData.workContext}

      RULES:
      1. Use Indian number formatting (Lakh, Crore).
      2. Be concise but deep. No general fluff.
      3. End with one actionable step.
      4. Always mention the user's specific numbers.
    `;

    const chatHistory = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: "user", content: text }
    ];

    try {
      const responseText = await callGroq(chatHistory);
      setMessages(prev => [...prev, { role: 'assistant', content: responseText, timestamp: new Date() }]);
    } catch (err) {
      if (err.message === 'MISSING_KEY') {
        setError('API_KEY_MISSING');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    `How do I get my score to 100?`,
    "What's the best sector for NPS?",
    "Should I increase my monthly contribution?",
    "Explain my retirement gap."
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col relative overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-60"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto space-y-8 animate-fade-in text-center px-4">
            <div className="w-24 h-24 rounded-full border-4 border-[#1E293B] bg-white flex items-center justify-center pop-shadow animate-bounce">
              <Sparkles className="w-12 h-12 text-[#F472B6]" strokeWidth={2.5} />
            </div>
            <div className="space-y-3">
              <h2 className="font-heading font-black text-3xl md:text-4xl text-[#1E293B]">Powered by Groq Spark</h2>
              <p className="text-base md:text-lg font-bold text-[#1E293B]/50 uppercase tracking-widest leading-tight">
                Hey {userData.firstName}! I'm optimized for lightning speed. Ask me anything.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {quickPrompts.map((txt, i) => (
                <QuickPrompt key={i} text={txt} onClick={handleSend} />
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full space-y-8">
            {messages.map((m, i) => (
              <MessageBubble key={i} {...m} />
            ))}
            {isLoading && <LoadingBubble />}
            {error && (
              <div className="flex flex-col items-start max-w-xl">
                <div className="bg-white border-4 border-[#1E293B] p-6 pop-shadow-pink space-y-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-[#F472B6]" strokeWidth={3} />
                    <h3 className="font-heading font-black text-lg text-[#1E293B] uppercase tracking-tight">
                      {error === 'API_KEY_MISSING' ? 'Key Required' : 'Engine Error'}
                    </h3>
                  </div>

                  {error === 'API_KEY_MISSING' ? (
                    <div className="space-y-3 text-sm font-bold text-slate-600 leading-relaxed">
                      <p>Lightning speed AI requires a **Groq API Key**.</p>
                      <div className="bg-[#FFFDF5] p-3 rounded-lg border-2 border-[#1E293B]">
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline text-[#8B5CF6] font-black">console.groq.com</a></li>
                          <li>Click <strong>Create API Key</strong></li>
                          <li>Add it to <code>.env.local</code> as:</li>
                          <code className="block bg-slate-100 p-2 mt-2 rounded border border-slate-200">VITE_GROQ_API_KEY=your_key</code>
                        </ol>
                      </div>
                    </div>
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
            {/* Added spacer to ensure last message is scrollable above the input */}
            <div className="h-20" />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[#FFFDF5] via-[#FFFDF5] to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto">
          <div className="bg-white border-2 border-[#1E293B] rounded-full p-2 pl-6 md:p-3 md:pl-8 flex items-center gap-4 pop-shadow relative">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent border-none outline-none text-sm md:text-lg font-bold text-[#1E293B] placeholder-slate-300"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#34D399] border-2 border-[#1E293B] flex items-center justify-center text-white pop-shadow transition-all hover:-translate-y-1 hover:translate-x-[-1px] disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isLoading ? (
                <Cpu className="w-5 h-5 md:w-6 md:h-6 animate-spin text-[#1E293B]" strokeWidth={3} />
              ) : (
                <Send className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[#1E293B]" strokeWidth={3} />
              )}
            </button>
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
