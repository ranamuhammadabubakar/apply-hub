import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Badge colour for each admission chance
const CHANCE_STYLES = {
  Safe: 'bg-green-100 text-green-800',
  'Good chance': 'bg-blue-100 text-blue-800',
  Reach: 'bg-orange-100 text-orange-800',
};

// Reasons that warn the student are shown in orange
const isWarning = (reason) => /above your budget|below the merit/i.test(reason);

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Recommendations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(null); // { text, ok }
  const [applying, setApplying] = useState('');
  const [applied, setApplied] = useState([]);

  useEffect(() => {
    api('/recommendations')
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function apply(r) {
    const key = `${r.institutionId}-${r.program}`;
    setMsg(null);
    setApplying(key);
    try {
      await api('/applications', { method: 'POST', body: { institutionId: r.institutionId, program: r.program } });
      setApplied((list) => [...list, key]);
      setMsg({ text: `${r.institution} (${r.program}): application submitted ✅`, ok: true });
    } catch (e) {
      setMsg({ text: e.message, ok: false });
    } finally {
      setApplying('');
    }
  }

  if (loading) return <p className="text-gray-500">Finding the best matches for you...</p>;

  if (error) {
    return (
      <p>
        {error}. <Link className="text-indigo-700 underline" to="/profile">Open profile</Link>
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Recommended for you</h2>
      <p className="text-sm text-gray-500 mb-4">
        Ranked by your field, marks, city, budget and interests.
      </p>

      {msg && (
        <p
          className={`mb-3 p-2 rounded text-sm border ${
            msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="space-y-3">
        {items.map((r) => {
          const key = `${r.institutionId}-${r.program}`;
          const isApplied = applied.includes(key);
          return (
            <div key={key} className="bg-white p-4 rounded-xl shadow flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-60">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {r.program} - {r.institution}
                  </h3>
                  {r.chance && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHANCE_STYLES[r.chance]}`}>
                      {r.chance}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600">
                  {r.city} · PKR {r.feePerYear.toLocaleString('en-US')}/yr · {r.score}% match
                  {r.deadline && <> · Apply by {formatDate(r.deadline)}</>}
                </p>

                <ul className="text-xs list-disc pl-5 mt-1">
                  {r.reasons.map((x) => (
                    <li key={x} className={isWarning(x) ? 'text-orange-600' : 'text-gray-500'}>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => apply(r)}
                disabled={isApplied || applying === key}
                className="bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {isApplied ? 'Applied' : applying === key ? 'Applying...' : 'Apply'}
              </button>
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="text-gray-500">No matches yet. Check the field and marks in your profile.</p>
        )}
      </div>
    </div>
  );
}