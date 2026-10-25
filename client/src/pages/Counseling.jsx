import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const STARTERS = [
  'Which careers suit my profile?',
  'I am confused between medicine and engineering.',
  'What can I study after FSc Pre-Engineering?',
];

export default function Counseling() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your Apply Hub career counselor. Tell me about your interests, or pick a question below.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text) {
    const clean = text.trim();
    if (!clean || loading) return;

    const next = [...messages, { role: 'user', text: clean }];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);

    try {
      // Skip the greeting so the first message sent is from the student
      const data = await api('/counseling', { method: 'POST', body: { messages: next.slice(1) } });
      setMessages((m) => [...m, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      <h1 className="text-2xl font-bold mb-1">AI Career Counseling</h1>
      <p className="text-gray-500 text-sm mb-4">
        Advice is based on your profile. Keep your profile updated for better suggestions.
      </p>

      <div className="flex-1 overflow-y-auto space-y-3 bg-white rounded-lg p-4 border">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm ${
                m.role === 'user' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">Counselor is typing...</div>}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-sm border rounded-full px-3 py-1 bg-white hover:bg-gray-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 mt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about careers, degrees or your future..."
          className="flex-1 border rounded-lg px-3 py-2 bg-white"
          maxLength={2000}
        />
        <button
          disabled={loading || !input.trim()}
          className="bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}