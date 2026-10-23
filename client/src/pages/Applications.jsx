import { useEffect, useState } from 'react';
import { api } from '../api';

const badge = {
  submitted: 'bg-blue-100 text-blue-800',
  'under-review': 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function Applications() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api('/applications/mine').then((d) => setItems(d.items));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">My Applications</h2>
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a._id} className="bg-white p-4 rounded-xl shadow flex items-center gap-3">
            <div className="flex-1">
              <h3 className="font-semibold">{a.program}</h3>
              <p className="text-sm text-gray-600">{a.institution?.name} · {new Date(a.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm ${badge[a.status]}`}>{a.status}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-500">You have not applied anywhere yet</p>}
      </div>
    </div>
  );
}