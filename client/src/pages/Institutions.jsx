import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Institutions() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    const t = setTimeout(() => {
      api(`/institutions?${params}`).then((d) => setItems(d.items));
    }, 300);
    return () => clearTimeout(t);
  }, [q, city]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Institutions</h2>
      <div className="flex gap-3 mb-4">
        <input className="border rounded p-2 flex-1" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="border rounded p-2 w-40" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i._id} className="bg-white p-4 rounded-xl shadow">
            <h3 className="font-semibold text-lg">{i.name}</h3>
            <p className="text-sm text-gray-600">{i.city} · {i.type}</p>
            <ul className="mt-2 text-sm list-disc pl-5">
              {i.programs.map((p) => (
                <li key={p._id}>{p.name}: min {p.minPercentage}%, PKR {p.feePerYear.toLocaleString()}/yr</li>
              ))}
            </ul>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500">No institutions found.</p>}
      </div>
    </div>
  );
}