import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const FIELDS = {
  medical: 'Medical',
  engineering: 'Engineering',
  cs: 'Computer Science',
  business: 'Business',
};

// Each option secretly gives one point to a field
const QUESTIONS = [
  {
    q: 'Which subject do you enjoy the most?',
    options: [
      { text: 'Biology', field: 'medical' },
      { text: 'Physics', field: 'engineering' },
      { text: 'Computer Science or Maths', field: 'cs' },
      { text: 'Economics or Accounting', field: 'business' },
    ],
  },
  {
    q: 'What would you like to do on a free afternoon?',
    options: [
      { text: 'Build or fix something with my hands', field: 'engineering' },
      { text: 'Help someone who is not feeling well', field: 'medical' },
      { text: 'Plan an event or sell something', field: 'business' },
      { text: 'Make a small app or game', field: 'cs' },
    ],
  },
  {
    q: 'Which problem would you most like to solve?',
    options: [
      { text: 'Build software used by millions of people', field: 'cs' },
      { text: 'Grow a small company into a big brand', field: 'business' },
      { text: 'Find better treatments for diseases', field: 'medical' },
      { text: 'Design cleaner energy or safer buildings', field: 'engineering' },
    ],
  },
  {
    q: 'Where would you like to work in the future?',
    options: [
      { text: 'In a hospital or clinic', field: 'medical' },
      { text: 'In my own business or a corporate office', field: 'business' },
      { text: 'On a site, factory or lab', field: 'engineering' },
      { text: 'On a computer, in an office or remotely', field: 'cs' },
    ],
  },
  {
    q: 'Which of these describes you best?',
    options: [
      { text: 'Logical and I love puzzles', field: 'cs' },
      { text: 'Caring and patient', field: 'medical' },
      { text: 'Practical and good with machines', field: 'engineering' },
      { text: 'Confident and good with people', field: 'business' },
    ],
  },
  {
    q: 'Which school project sounds the most fun?',
    options: [
      { text: 'A stall at the school bazaar', field: 'business' },
      { text: 'A website or quiz app', field: 'cs' },
      { text: 'A model of the human heart', field: 'medical' },
      { text: 'A small solar-powered car', field: 'engineering' },
    ],
  },
  {
    q: 'Who would you most like to become?',
    options: [
      { text: 'A successful engineer', field: 'engineering' },
      { text: 'A respected doctor', field: 'medical' },
      { text: 'A software developer at a tech company', field: 'cs' },
      { text: 'An entrepreneur or business leader', field: 'business' },
    ],
  },
  {
    q: 'What matters most to you in a future job?',
    options: [
      { text: 'Leading people and earning well', field: 'business' },
      { text: 'Creating real things people use', field: 'engineering' },
      { text: 'Helping people directly', field: 'medical' },
      { text: 'Working with new technology', field: 'cs' },
    ],
  },
];

export default function Quiz() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { text, ok }

  const total = QUESTIONS.length;
  const finished = step >= total;

  function choose(field) {
    const next = [...answers];
    next[step] = field;
    setAnswers(next);
    setStep(step + 1);
  }

  function restart() {
    setAnswers([]);
    setStep(0);
    setMsg(null);
  }

  // Result screen
  if (finished) {
    const counts = Object.keys(FIELDS).map((key) => ({
      key,
      label: FIELDS[key],
      percent: Math.round((answers.filter((a) => a === key).length / total) * 100),
    }));
    counts.sort((a, b) => b.percent - a.percent);
    const top = counts[0];

    async function saveToProfile() {
      setSaving(true);
      setMsg(null);
      try {
        // Only the field is sent; the server keeps marks, city and budget as they are
        await api('/profile', { method: 'PUT', body: { field: top.key } });
        setMsg({ text: `${top.label} saved as your field of interest ✅`, ok: true });
      } catch (e) {
        setMsg({ text: e.message, ok: false });
      } finally {
        setSaving(false);
      }
    }

    function discussWithAI() {
      const summary = counts.map((c) => `${c.label} ${c.percent}%`).join(', ');
      navigate('/counseling', {
        state: {
          initialMessage: `I took the career quiz. My results: ${summary}. Which careers and degree programs suit me?`,
        },
      });
    }

    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold mb-1">Your career quiz result</h2>
        <p className="text-gray-500 text-sm mb-4">Based on your answers to {total} questions.</p>

        <div className="bg-white p-5 rounded-xl shadow mb-4">
          <p className="text-sm text-gray-500">Your best match</p>
          <p className="text-3xl font-bold text-indigo-700">{top.label}</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow space-y-3">
          {counts.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between text-sm mb-1">
                <span>{c.label}</span>
                <span className="text-gray-500">{c.percent}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-indigo-600 rounded-full" style={{ width: `${c.percent}%` }} />
              </div>
            </div>
          ))}
        </div>

        {msg && (
          <p
            className={`mt-4 p-2 rounded text-sm border ${
              msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {msg.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={saveToProfile}
            disabled={saving}
            className="bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save to my profile'}
          </button>
          <button onClick={discussWithAI} className="border border-indigo-700 text-indigo-700 px-4 py-2 rounded bg-white hover:bg-indigo-50">
            Discuss with AI counselor
          </button>
          <button onClick={restart} className="border px-4 py-2 rounded bg-white hover:bg-gray-100">
            Retake quiz
          </button>
        </div>
      </div>
    );
  }

  // Question screen
  const current = QUESTIONS[step];
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-1">Career Assessment Quiz</h2>
      <p className="text-gray-500 text-sm mb-4">Answer honestly. There are no right or wrong answers.</p>

      <div className="h-2 bg-gray-200 rounded-full mb-2">
        <div className="h-2 bg-indigo-600 rounded-full" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Question {step + 1} of {total}
      </p>

      <div className="bg-white p-5 rounded-xl shadow">
        <h3 className="font-semibold text-lg mb-4">{current.q}</h3>
        <div className="space-y-2">
          {current.options.map((o) => (
            <button
              key={o.text}
              onClick={() => choose(o.field)}
              className={`w-full text-left border rounded-lg px-4 py-3 hover:bg-indigo-50 hover:border-indigo-400 ${
                answers[step] === o.field ? 'border-indigo-600 bg-indigo-50' : ''
              }`}
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="mt-4 text-sm text-indigo-700 underline">
          Back
        </button>
      )}
    </div>
  );
}