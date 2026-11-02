import { useEffect, useState } from 'react';
import { api } from '../api';

const TYPE_LABELS = {
  university: 'University',
  'medical-college': 'Medical college',
  school: 'School',
  academy: 'Academy',
};

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const isPast = (value) => value && new Date(value) < new Date();

export default function Institutions() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (type) params.set('type', type);
    setLoading(true);
    const t = setTimeout(() => {
      api(`/institutions?${params}`)
        .then((d) => {
          setItems(d.items);
          setError('');
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, city, type]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Institutions</h2>
      <p className="text-sm text-gray-500 mb-4">
        Admission details change every year. Always confirm merit, fees and deadlines on the official website.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="border rounded p-2 flex-1 min-w-48" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="border rounded p-2 w-40" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <select className="border rounded p-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {loading && items.length === 0 && <p className="text-gray-500">Loading institutions...</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i._id} className="bg-white p-4 rounded-xl shadow flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-lg">{i.name}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  i.sector === 'public' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {i.sector === 'public' ? 'Public' : 'Private'}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {i.city} · {TYPE_LABELS[i.type] || i.type}
            </p>
            {i.description && <p className="text-sm text-gray-700 mt-1">{i.description}</p>}

            <ul className="mt-3 text-sm space-y-1">
              {i.programs.map((p) => {
                const deadline = p.deadline || i.deadline;
                return (
                  <li key={p._id} className="border-t border-gray-100 pt-1">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-600">
                      {' '}· min {p.minPercentage}% · PKR {p.feePerYear.toLocaleString('en-US')}/yr
                    </span>
                    {deadline && (
                      <span className={isPast(deadline) ? 'text-red-600' : 'text-gray-600'}>
                        {' '}· {isPast(deadline) ? 'Closed' : `Apply by ${formatDate(deadline)}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
              {i.admissionUrl && (
                <a
                  href={i.admissionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-indigo-700 text-white text-sm px-3 py-1.5 rounded"
                >
                  Apply on official portal
                </a>
              )}
              {i.website && (
                <a href={i.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-700 underline">
                  Official website
                </a>
              )}
              <span className="text-xs text-gray-500 ml-auto">
                {i.lastVerifiedAt ? `Info verified on ${formatDate(i.lastVerifiedAt)}` : 'Not yet verified'}
              </span>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <p className="text-gray-500">No institutions found.</p>}
      </div>
    </div>
  );
}