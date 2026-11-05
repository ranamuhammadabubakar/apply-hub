import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

const FIELDS = [
  ['medical', 'Medical'],
  ['engineering', 'Engineering'],
  ['cs', 'Computer Science / IT'],
  ['business', 'Business'],
  ['other', 'Other'],
];

// Quick picks; these words also appear in program names, so they help recommendations
const SUGGESTIONS = [
  'Computer', 'Software', 'Data', 'Electrical', 'Mechanical',
  'Medicine', 'Biology', 'Business', 'Accounting', 'Robotics',
];

// "biology, Coding ,  " -> ["biology", "Coding"] (no empty items, no duplicates)
function parseInterests(text) {
  const seen = new Set();
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Only allow returning to pages on this site
function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function Profile() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [p, setP] = useState({ field: 'other', percentage: '', city: '', maxBudget: '' });
  const [interestsText, setInterestsText] = useState('');
  const [msg, setMsg] = useState(null); // { text, ok }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/profile').then((d) => {
      setP({ ...d.profile });
      setInterestsText((d.profile.interests || []).join(', '));
    });
  }, []);

  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const current = parseInterests(interestsText);
  const isSelected = (word) => current.some((i) => i.toLowerCase() === word.toLowerCase());

  function toggle(word) {
    const list = isSelected(word)
      ? current.filter((i) => i.toLowerCase() !== word.toLowerCase())
      : [...current, word];
    setInterestsText(list.join(', '));
  }

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await api('/profile', { method: 'PUT', body: { ...p, interests: current } });
      if (next) {
        navigate(next, { replace: true });
        return;
      }
      setMsg({ text: 'Profile saved ✅', ok: true });
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md bg-white p-6 rounded-xl shadow space-y-3">
      <h2 className="text-2xl font-semibold">My Profile</h2>
      {next && (
        <p className="text-sm bg-indigo-50 border border-indigo-200 text-indigo-800 rounded p-2">
          Add your marks and field, then save to see your chance of admission.
        </p>
      )}

      <label className="block text-sm">Field of interest
        <select className="w-full border rounded p-2 mt-1" value={p.field} onChange={set('field')}>
          {FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <label className="block text-sm">Intermediate / FSc marks (%)
        <input className="w-full border rounded p-2 mt-1" type="number" min="0" max="100" value={p.percentage} onChange={set('percentage')} />
      </label>

      <label className="block text-sm">Preferred city
        <input className="w-full border rounded p-2 mt-1" value={p.city} onChange={set('city')} placeholder="Lahore" />
      </label>

      <label className="block text-sm">Yearly budget (PKR)
        <input className="w-full border rounded p-2 mt-1" type="number" min="0" value={p.maxBudget} onChange={set('maxBudget')} />
      </label>

      <div className="text-sm">
        <label className="block">Interests
          <input
            className="w-full border rounded p-2 mt-1"
            value={interestsText}
            onChange={(e) => setInterestsText(e.target.value)}
            placeholder="e.g. Computer, Robotics, Biology"
          />
        </label>
        <p className="text-xs text-gray-500 mt-1">Separate with commas, or pick below.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTIONS.map((w) => (
            <button
              type="button"
              key={w}
              onClick={() => toggle(w)}
              className={`text-xs px-3 py-1 rounded-full border ${
                isSelected(w) ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white hover:bg-gray-100'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <button disabled={saving} className="bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50">
        {saving ? 'Saving...' : next ? 'Save and continue' : 'Save'}
      </button>

      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </form>
  );
}