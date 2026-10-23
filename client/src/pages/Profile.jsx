import { useEffect, useState } from 'react';
import { api } from '../api';

const FIELDS = [
  ['medical', 'Medical'],
  ['engineering', 'Engineering'],
  ['cs', 'Computer Science / IT'],
  ['business', 'Business'],
  ['other', 'Other'],
];

export default function Profile() {
  const [p, setP] = useState({ field: 'other', percentage: '', city: '', maxBudget: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/profile').then((d) => setP({ ...d.profile }));
  }, []);

  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/profile', { method: 'PUT', body: p });
      setMsg('Profile saved ✅');
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md bg-white p-6 rounded-xl shadow space-y-3">
      <h2 className="text-2xl font-semibold">My Profile</h2>
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
      <button className="bg-indigo-700 text-white px-4 py-2 rounded">Save</button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}