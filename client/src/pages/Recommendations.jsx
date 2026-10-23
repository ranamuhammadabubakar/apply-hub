import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Recommendations() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/recommendations').then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, []);

  async function apply(r) {
    setMsg('');
    try {
      await api('/applications', { method: 'POST', body: { institutionId: r.institutionId, program: r.program } });
      setMsg(`${r.institution} (${r.program}): application submitted ✅`);
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (error) {
    return <p>{error}. <Link className="text-indigo-700 underline" to="/profile">Open profile</Link></p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Recommended for you</h2>
      {msg && <p className="mb-3 bg-green-50 border border-green-200 p-2 rounded text-sm">{msg}</p>}
      <div className="space-y-3">
        {items.map((r, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl shadow flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-60">
              <h3 className="font-semibold">{r.program} - {r.institution}</h3>
              <p className="text-sm text-gray-600">{r.city} · PKR {r.feePerYear.toLocaleString()}/yr · {r.score}% match</p>
              <ul className="text-xs text-gray-500 list-disc pl-5 mt-1">
                {r.reasons.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
            <button onClick={() => apply(r)} className="bg-indigo-700 text-white px-4 py-2 rounded">Apply</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500">No matches yet. Check the field and marks in your profile.</p>}
      </div>
    </div>
  );
}