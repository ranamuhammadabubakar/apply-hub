import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Badge colour for each admission chance
const CHANCE_STYLES = {
  Safe: 'bg-green-100 text-green-800',
  'Good chance': 'bg-blue-100 text-blue-800',
  Reach: 'bg-orange-100 text-orange-800',
  'Check merit': 'bg-gray-100 text-gray-700',
};

const FIELD_LABELS = {
  medical: 'Medical',
  engineering: 'Engineering',
  cs: 'Computer Science',
  business: 'Business',
  other: 'Other',
};

// Reasons that warn the student are shown in orange
const isWarning = (reason) => /above your budget|below the merit|not published/i.test(reason);

const isKnown = (value) => value !== null && value !== undefined;

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const keyOf = (institutionId, program) => `${institutionId}-${program}`;

export default function Recommendations() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [profileField, setProfileField] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(null); // { text, ok }
  const [applying, setApplying] = useState('');
  const [applied, setApplied] = useState([]);

  useEffect(() => {
    // Load recommendations and the student's existing applications together
    Promise.all([api('/recommendations'), api('/applications/mine')])
      .then(([rec, mine]) => {
        setItems(rec.items);
        setTotal(rec.total ?? rec.items.length);
        setProfileField(rec.profileField || '');
        setApplied(mine.items.map((a) => keyOf(a.institution?._id, a.program)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function apply(r) {
    const key = keyOf(r.institutionId, r.program);
    setMsg(null);
    setApplying(key);
    try {
      await api('/applications', { method: 'POST', body: { institutionId: r.institutionId, program: r.program } });
      setApplied((list) => [...list, key]);
      setMsg({ text: `${r.institution} (${r.program}) added to your applications ✅`, ok: true });
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

  const openToAll = profileField === 'other';

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Recommended for you</h2>
      <p className="text-sm text-gray-500 mb-4">
        Ranked by your field, marks, city, budget and interests.
        {total > items.length ? ` Showing the top ${items.length} of ${total} matches.` : ''}
      </p>

      {openToAll && (
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex-1 min-w-60">
            <p className="font-semibold text-indigo-900">Not sure which field suits you?</p>
            <p className="text-sm text-indigo-800">
              Take the two minute career quiz. It finds your best field and can save it to your profile, so these
              matches become more focused.
            </p>
          </div>
          <Link to="/quiz" className="bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded">
            Take the career quiz
          </Link>
        </div>
      )}

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
          const key = keyOf(r.institutionId, r.program);
          const isApplied = applied.includes(key);
          const officialLink = r.admissionUrl || r.website;
          return (
            <div key={key} className="bg-white p-4 rounded-xl shadow flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-60">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {r.program} - {r.institution}
                  </h3>
                  {r.chance && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHANCE_STYLES[r.chance] || CHANCE_STYLES['Check merit']}`}>
                      {r.chance}
                    </span>
                  )}
                  {openToAll && r.field && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-700">
                      {FIELD_LABELS[r.field] || r.field}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600">
                  {r.city} · {isKnown(r.feePerYear) ? `PKR ${r.feePerYear.toLocaleString('en-US')}/yr` : 'Fee not published'} ·{' '}
                  {r.score}% match
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

              <div className="flex flex-col items-stretch gap-2">
                {officialLink && (
                  <a
                    href={officialLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-center text-sm border border-indigo-700 text-indigo-700 px-4 py-2 rounded hover:bg-indigo-50"
                  >
                    {r.admissionUrl ? 'Official portal' : 'Official website'}
                  </a>
                )}
                <button
                  onClick={() => apply(r)}
                  disabled={isApplied || applying === key}
                  className="bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {isApplied ? 'Tracking' : applying === key ? 'Adding...' : 'Track application'}
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="text-gray-500">
            No matches yet. Check the field and marks in your{' '}
            <Link className="text-indigo-700 underline" to="/profile">profile</Link>, or{' '}
            <Link className="text-indigo-700 underline" to="/institutions">browse all universities</Link>.
          </p>
        )}
      </div>
    </div>
  );
}