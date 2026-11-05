import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const BRAND = '#4338CA';
const BORDER = '#E0E7FF';

const QUICK_QUESTIONS = [
  'Which careers suit my profile?',
  'How is MBBS merit calculated?',
  'Best engineering fields for jobs',
];

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function AiBadge() {
  return (
    <span
      className="w-7 h-7 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center"
      style={{ background: '#EEF2FF', color: BRAND }}
      aria-hidden="true"
    >
      AI
    </span>
  );
}

export default function ChatWidget() {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', text }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef([]);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Focus the input when the panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest message in view
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy, open]);

  // Close with the Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The Ask AI page already has a full chat
  if (location.pathname === '/counseling') return null;

  function updateMessages(list) {
    messagesRef.current = list;
    setMessages(list);
  }

  async function ask(text) {
    const clean = text.trim();
    if (!clean || busy) return;
    setError('');
    setBusy(true);
    setQuestion('');

    const next = [...messagesRef.current, { role: 'user', text: clean }];
    updateMessages(next);

    try {
      // Students get answers from their profile; visitors get general answers without an account
      const path = user ? '/counseling' : '/counseling/public';
      const data = await api(path, { method: 'POST', body: { messages: next } });
      updateMessages([...messagesRef.current, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function startOver() {
    updateMessages([]);
    setError('');
    inputRef.current?.focus();
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Apply Hub counselor"
          className="fixed bottom-24 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 h-[70vh] max-h-[560px] bg-white rounded-2xl border flex flex-col overflow-hidden"
          style={{ borderColor: BORDER, boxShadow: '0 24px 60px -20px rgba(15, 10, 60, 0.45)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: BRAND }}>
            <span className="w-8 h-8 rounded-full bg-white/20 text-xs font-bold flex items-center justify-center" aria-hidden="true">
              AI
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">Apply Hub counselor</p>
              <p className="text-xs text-indigo-100">
                {user ? 'Answers based on your profile' : 'Ask about careers, merit and admissions'}
              </p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={startOver} disabled={busy} className="text-xs underline underline-offset-2 disabled:opacity-50">
                New chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-[#FAFBFF]" aria-live="polite">
            {messages.length === 0 && (
              <>
                <div className="flex items-start gap-2">
                  <AiBadge />
                  <p className="max-w-[85%] bg-white border rounded-2xl rounded-tl-md px-3 py-2 text-sm text-gray-800" style={{ borderColor: BORDER }}>
                    Hi! I can help you choose a career, compare programs and understand merit. What would you like to know?
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pl-9">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      disabled={busy}
                      className="text-xs border rounded-full px-3 py-1.5 bg-white hover:border-[#4338CA] disabled:opacity-50"
                      style={{ color: BRAND, borderColor: BORDER }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] text-white text-sm rounded-2xl rounded-br-md px-3 py-2 whitespace-pre-wrap" style={{ background: BRAND }}>
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <AiBadge />
                  <p
                    className="max-w-[85%] bg-white border rounded-2xl rounded-tl-md px-3 py-2 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap"
                    style={{ borderColor: BORDER }}
                  >
                    {m.text}
                  </p>
                </div>
              )
            )}

            {busy && (
              <div className="flex items-start gap-2">
                <AiBadge />
                <span className="bg-white border rounded-2xl rounded-tl-md px-3 py-2.5 flex gap-1" style={{ borderColor: BORDER }}>
                  <span className="sr-only">Writing an answer</span>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce motion-reduce:animate-none"
                      style={{ background: BRAND, animationDelay: `${d * 0.15}s` }}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              </div>
            )}

            {error && <p className="text-sm text-red-600 px-1">{error}</p>}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="p-2 border-t"
            style={{ borderColor: BORDER }}
          >
            <label htmlFor="widget-question" className="sr-only">
              Your question
            </label>
            <div className="flex items-end gap-2 bg-[#F8F9FF] border rounded-xl px-2 py-1.5" style={{ borderColor: BORDER }}>
              <textarea
                id="widget-question"
                ref={inputRef}
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(question);
                  }
                }}
                placeholder="Type your question"
                maxLength={2000}
                className="flex-1 resize-none bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 py-1.5"
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                aria-label="Send question"
                className="w-9 h-9 shrink-0 rounded-lg text-white flex items-center justify-center disabled:opacity-40"
                style={{ background: BRAND }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="mt-1 px-1 text-[11px] text-gray-400">AI can make mistakes. Check details on official websites.</p>
          </form>
        </div>
      )}

      {/* Floating button: white so it stands out on both indigo and light pages */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close the counselor chat' : 'Open the counselor chat'}
        aria-expanded={open}
        className="fixed bottom-5 right-4 sm:right-6 z-40 h-14 rounded-full bg-white flex items-center gap-2 border-2 hover:scale-105 transition-transform motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4"
        style={{
          color: BRAND,
          borderColor: BRAND,
          padding: open ? '0' : '0 20px 0 16px',
          width: open ? '56px' : 'auto',
          justifyContent: 'center',
          boxShadow: '0 14px 34px -8px rgba(15, 10, 60, 0.55)',
        }}
      >
        {open ? (
          <CloseIcon />
        ) : (
          <>
            <ChatIcon />
            <span className="font-semibold text-sm">Ask AI</span>
          </>
        )}
      </button>
    </>
  );
}