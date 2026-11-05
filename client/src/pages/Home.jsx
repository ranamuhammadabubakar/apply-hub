import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const BRAND = '#4338CA'; // Royal Indigo, the one theme colour
const BORDER = '#E0E7FF';
const DISPLAY_FONT = { fontFamily: 'var(--font-heading)' };

// Short label on the chip, full question sent to the AI
const COMMON_QUESTIONS = [
  { label: 'BS CS in Lahore with 82%?', question: 'Can I get BS Computer Science in Lahore with 82% in FSc?' },
  { label: 'How is MBBS merit calculated?', question: 'How is the MBBS merit calculated in Punjab?' },
  { label: 'Best engineering fields for jobs', question: 'Which engineering fields have good jobs in Pakistan?' },
];

const STEPS = [
  {
    title: 'Add your marks and interests',
    text: 'Fill in your profile, or take the two minute career quiz if you are not sure yet.',
    to: '/quiz',
    link: 'Take the quiz',
  },
  {
    title: 'See programs that fit you',
    text: 'Programs are ranked by your marks, city and budget, with your chance of admission.',
    to: '/recommendations',
    link: 'See my matches',
  },
  {
    title: 'Apply on the official portal',
    text: 'Every university links to its own admission page. Keep track of what you applied to here.',
    to: '/applications',
    link: 'My applications',
  },
];

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AiBadge({ small = false }) {
  return (
    <span
      className={`${small ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs'} shrink-0 rounded-full font-bold flex items-center justify-center`}
      style={{ background: '#EEF2FF', color: BRAND }}
      aria-hidden="true"
    >
      AI
    </span>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', text }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const messagesRef = useRef([]);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    api('/institutions/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Keep the newest message in view
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

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

  const hasChat = messages.length > 0;

  return (
    <div className="pb-10">
      {/* Solid Royal Indigo band across the full width */}
      <section style={{ background: BRAND }}>
        <div className={`max-w-5xl mx-auto px-4 text-center ${hasChat ? 'py-8' : 'py-14 sm:py-20'}`}>
          <h1
            className={`font-extrabold leading-[1.05] max-w-3xl mx-auto text-white ${
              hasChat ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-6xl'
            }`}
            style={DISPLAY_FONT}
          >
            Hello, future graduate.
          </h1>
          {!hasChat && (
            <p className="mt-5 text-lg text-indigo-100 max-w-2xl mx-auto">
              Ask anything about merit, fees, deadlines or careers. Answers use your profile, and every university
              links to its official admission page.
            </p>
          )}

          {/* Chat card */}
          <div
            className={`${hasChat ? 'mt-6' : 'mt-10'} max-w-2xl mx-auto text-left bg-white rounded-2xl overflow-hidden`}
            style={{ boxShadow: '0 24px 50px -20px rgba(15, 10, 60, 0.55)' }}
          >
            {hasChat && (
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-2">
                  <AiBadge />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Apply Hub counselor</p>
                    <p className="text-xs text-gray-500">
                      {user ? 'Answers based on your profile' : 'General answers. Log in for advice based on your marks.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startOver}
                  disabled={busy}
                  className="text-sm font-medium rounded-md px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"
                  style={{ color: BRAND }}
                >
                  New chat
                </button>
              </div>
            )}

            {/* Messages */}
            {(hasChat || error) && (
              <div className="px-4 py-5 space-y-4 max-h-[55vh] overflow-y-auto bg-[#FAFBFF]" aria-live="polite">
                {messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <p
                        className="max-w-[85%] text-white rounded-2xl rounded-br-md px-4 py-2.5 whitespace-pre-wrap"
                        style={{ background: BRAND }}
                      >
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2.5">
                      <AiBadge small />
                      <p
                        className="max-w-[85%] bg-white border rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap"
                        style={{ borderColor: BORDER }}
                      >
                        {m.text}
                      </p>
                    </div>
                  )
                )}

                {busy && (
                  <div className="flex items-start gap-2.5">
                    <AiBadge small />
                    <span className="bg-white border rounded-2xl rounded-tl-md px-4 py-3 flex gap-1" style={{ borderColor: BORDER }}>
                      <span className="sr-only">Writing an answer</span>
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="w-2 h-2 rounded-full animate-bounce motion-reduce:animate-none"
                          style={{ background: BRAND, animationDelay: `${d * 0.15}s` }}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
              className={`p-3 ${hasChat ? 'border-t' : ''}`}
              style={{ borderColor: BORDER }}
            >
              <label htmlFor="home-question" className="sr-only">
                Your question
              </label>
              <div
                className="flex items-end gap-2 bg-[#F8F9FF] border rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#4338CA]/30"
                style={{ borderColor: BORDER }}
              >
                <textarea
                  id="home-question"
                  ref={inputRef}
                  rows={hasChat ? 1 : 2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      ask(question);
                    }
                  }}
                  placeholder={hasChat ? 'Ask a follow-up question' : 'Ask about merit, fees, deadlines or careers'}
                  maxLength={2000}
                  className="flex-1 resize-none bg-transparent outline-none text-base text-gray-900 placeholder:text-gray-400 py-1.5"
                />
                <button
                  type="submit"
                  disabled={busy || !question.trim()}
                  aria-label="Send question"
                  className="w-10 h-10 shrink-0 rounded-lg text-white flex items-center justify-center disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: BRAND }}
                >
                  <SendIcon />
                </button>
              </div>
              <p className="mt-2 px-1 text-xs text-gray-500">
                English or Roman Urdu. Press Enter to send, Shift + Enter for a new line.
              </p>
            </form>
          </div>

          {hasChat ? (
            <p className="mt-3 text-xs text-indigo-100">
              AI can make mistakes. Check important details on the official website.
              {!user && (
                <>
                  {' '}
                  <Link to="/login?mode=register&next=%2F" className="underline font-semibold text-white">
                    Create a free account
                  </Link>{' '}
                  for advice based on your marks.
                </>
              )}
            </p>
          ) : (
            <div className="mt-8">
              <p className="text-sm font-medium text-indigo-100 mb-3">Students often ask</p>
              {/* One row of chips; on small screens it scrolls sideways */}
              <div className="flex flex-nowrap sm:justify-center gap-2 max-w-4xl mx-auto overflow-x-auto pb-2 -mx-4 px-4 sm:mx-auto sm:px-0">
                {COMMON_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => ask(q.question)}
                    disabled={busy}
                    title={q.question}
                    className="shrink-0 whitespace-nowrap text-sm text-white bg-white/10 border border-white/30 rounded-full px-4 py-2 hover:bg-white/20 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-sm text-indigo-100">
                Covering{' '}
                <Link to="/institutions" className="font-semibold text-white underline underline-offset-4">
                  {stats ? `${stats.total} universities and colleges` : 'universities and colleges'}
                </Link>{' '}
                across Pakistan.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Light content below the band */}
      <div className="max-w-5xl mx-auto px-4 pt-16 space-y-16">
        {/* How it works: a real sequence, so it is numbered */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ ...DISPLAY_FONT, color: BRAND }}>
            Three steps to your admission
          </h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 pt-4" style={{ borderColor: BRAND }}>
                <p className="text-sm font-semibold text-gray-500">Step {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold" style={{ color: BRAND }}>
                  {s.title}
                </h3>
                <p className="mt-1 text-gray-600">{s.text}</p>
                <Link to={s.to} className="inline-block mt-3 font-medium underline underline-offset-4" style={{ color: BRAND }}>
                  {s.link}
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* Institutions by province */}
        {stats?.byProvince?.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-1 text-center" style={{ ...DISPLAY_FONT, color: BRAND }}>
              Universities and colleges by province
            </h2>
            <p className="text-gray-600 mb-4 text-center">Choose a province to see its recognised universities and colleges.</p>
            <ul
              className="grid gap-x-12 md:grid-cols-2 bg-white border rounded-xl px-5 py-2 max-w-3xl mx-auto"
              style={{ borderColor: BORDER }}
            >
              {stats.byProvince.map((p) => (
                <li key={p.province}>
                  <Link
                    to={`/institutions?province=${encodeURIComponent(p.province)}`}
                    className="flex items-baseline gap-2 py-2.5 hover:underline underline-offset-4"
                    style={{ color: BRAND }}
                  >
                    <span>{p.province}</span>
                    <span className="flex-1 border-b border-dotted border-gray-300" aria-hidden="true" />
                    <span className="font-semibold tabular-nums">{p.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-gray-500 text-center">
          Apply Hub is an independent guide and is not affiliated with HEC, PMDC or any university. Always confirm merit,
          fees and deadlines on the official website.
        </p>
      </div>
    </div>
  );
}