import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const TYPES = ['university', 'medical-college', 'school', 'academy'];
const SECTORS = ['public', 'private'];
const STATUSES = ['submitted', 'under-review', 'accepted', 'rejected'];
const FIELDS = ['medical', 'engineering', 'cs', 'business', 'other'];

const emptyForm = {
  name: '', type: 'university', sector: 'private', city: '', website: '', admissionUrl: '',
  description: '', deadline: '', programsText: '', verifiedNow: false,
};

const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Program line: Name | field | min % | fee per year | deadline (optional, YYYY-MM-DD)
const programsToText = (programs = []) =>
  programs
    .map((p) => {
      const parts = [p.name, p.field, p.minPercentage, p.feePerYear];
      if (p.deadline) parts.push(toDateInput(p.deadline));
      return parts.join(' | ');
    })
    .join('\n');

function textToPrograms(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, field, min, fee, deadline] = line.split('|').map((s) => s.trim());
      if (!name || !FIELDS.includes(field)) {
        throw new Error(`Invalid program line: "${line}". Use: Name | field | min % | fee per year | deadline (optional)`);
      }
      if (deadline && Number.isNaN(Date.parse(deadline))) {
        throw new Error(`Invalid deadline in line: "${line}". Use the format YYYY-MM-DD`);
      }
      return {
        name,
        field,
        minPercentage: Number(min) || 0,
        feePerYear: Number(fee) || 0,
        deadline: deadline || null,
      };
    });
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('institutions');
  const [institutions, setInstitutions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');

  const isAdmin = user?.role === 'admin';

  async function loadInstitutions() {
    const d = await api('/institutions');
    setInstitutions(d.items);
  }
  async function loadApplications() {
    const d = await api('/applications');
    setApplications(d.items);
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadInstitutions().catch((e) => setMsg(e.message));
    loadApplications().catch((e) => setMsg(e.message));
  }, [isAdmin]);

  if (loading) return <p>Loading...</p>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function startEdit(i) {
    setEditingId(i._id);
    setForm({
      name: i.name,
      type: i.type,
      sector: i.sector || 'private',
      city: i.city,
      website: i.website || '',
      admissionUrl: i.admissionUrl || '',
      description: i.description || '',
      deadline: toDateInput(i.deadline),
      programsText: programsToText(i.programs),
      verifiedNow: false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveInstitution(e) {
    e.preventDefault();
    setMsg('');
    try {
      const body = {
        name: form.name,
        type: form.type,
        sector: form.sector,
        city: form.city,
        website: form.website,
        admissionUrl: form.admissionUrl,
        description: form.description,
        deadline: form.deadline || null,
        programs: textToPrograms(form.programsText),
      };
      if (form.verifiedNow) body.lastVerifiedAt = new Date().toISOString();

      if (editingId) await api(`/institutions/${editingId}`, { method: 'PUT', body });
      else await api('/institutions', { method: 'POST', body });
      setMsg(editingId ? 'Institution updated.' : 'Institution added.');
      resetForm();
      await loadInstitutions();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function removeInstitution(id) {
    if (!window.confirm('Delete this institution?')) return;
    try {
      await api(`/institutions/${id}`, { method: 'DELETE' });
      await loadInstitutions();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function changeStatus(id, status) {
    try {
      await api(`/applications/${id}/status`, { method: 'PATCH', body: { status } });
      setApplications((list) => list.map((a) => (a._id === id ? { ...a, status } : a)));
    } catch (err) {
      setMsg(err.message);
    }
  }

  const tabBtn = (key, label) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded ${tab === key ? 'bg-indigo-700 text-white' : 'bg-white border'}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Admin Panel</h2>
      <div className="flex gap-2 mb-4">
        {tabBtn('institutions', 'Institutions')}
        {tabBtn('applications', 'Applications')}
      </div>
      {msg && <p className="mb-3 bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">{msg}</p>}

      {tab === 'institutions' && (
        <div className="space-y-6">
          <form onSubmit={saveInstitution} className="bg-white p-4 rounded-xl shadow space-y-3">
            <h3 className="font-semibold">{editingId ? 'Edit institution' : 'Add institution'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="border rounded p-2" placeholder="Name" value={form.name} onChange={set('name')} required />
              <input className="border rounded p-2" placeholder="City" value={form.city} onChange={set('city')} required />
              <select className="border rounded p-2" value={form.type} onChange={set('type')}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="border rounded p-2" value={form.sector} onChange={set('sector')}>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="text-sm text-gray-600">
                Admission deadline (institution)
                <input className="border rounded p-2 w-full mt-1" type="date" value={form.deadline} onChange={set('deadline')} />
              </label>
              <span />
              <input className="border rounded p-2" placeholder="Website (optional)" value={form.website} onChange={set('website')} />
              <input className="border rounded p-2" placeholder="Official admission portal link" value={form.admissionUrl} onChange={set('admissionUrl')} />
            </div>
            <textarea className="w-full border rounded p-2" rows="2" placeholder="Description" value={form.description} onChange={set('description')} />
            <label className="block text-sm">
              Programs, one per line: Name | field | min % | fee per year | deadline (optional)
              <textarea
                className="w-full border rounded p-2 mt-1 font-mono text-sm"
                rows="5"
                placeholder={'BS Computer Science | cs | 70 | 250000 | 2026-11-30'}
                value={form.programsText}
                onChange={set('programsText')}
              />
            </label>
            <p className="text-xs text-gray-500">Fields: {FIELDS.join(', ')}. Deadline format: YYYY-MM-DD.</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.verifiedNow}
                onChange={(e) => setForm({ ...form, verifiedNow: e.target.checked })}
              />
              I checked this data against the official website today
            </label>
            <div className="flex gap-2">
              <button className="bg-indigo-700 text-white px-4 py-2 rounded">{editingId ? 'Update' : 'Add'}</button>
              {editingId && <button type="button" onClick={resetForm} className="border px-4 py-2 rounded">Cancel</button>}
            </div>
          </form>

          <div className="space-y-3">
            {institutions.map((i) => (
              <div key={i._id} className="bg-white p-4 rounded-xl shadow flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-60">
                  <h3 className="font-semibold">{i.name}</h3>
                  <p className="text-sm text-gray-600">
                    {i.city} · {i.type} · {i.sector || 'private'} · {i.programs.length} programs
                  </p>
                  <p className="text-xs mt-1">
                    {i.lastVerifiedAt ? (
                      <span className="text-green-700">Verified: {formatDate(i.lastVerifiedAt)}</span>
                    ) : (
                      <span className="text-orange-600">Not verified</span>
                    )}
                    {i.admissionUrl ? (
                      <>
                        {' · '}
                        <a href={i.admissionUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                          Admission portal
                        </a>
                      </>
                    ) : (
                      <span className="text-orange-600"> · No admission link</span>
                    )}
                  </p>
                </div>
                <button onClick={() => startEdit(i)} className="border px-3 py-1 rounded">Edit</button>
                <button onClick={() => removeInstitution(i._id)} className="bg-red-600 text-white px-3 py-1 rounded">Delete</button>
              </div>
            ))}
            {institutions.length === 0 && <p className="text-gray-500">No institutions yet.</p>}
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <div className="space-y-3">
          {applications.map((a) => (
            <div key={a._id} className="bg-white p-4 rounded-xl shadow flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-60">
                <h3 className="font-semibold">{a.program} — {a.institution?.name}</h3>
                <p className="text-sm text-gray-600">
                  {a.student?.name} ({a.student?.email}) · {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <select className="border rounded p-2" value={a.status} onChange={(e) => changeStatus(a._id, e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
          {applications.length === 0 && <p className="text-gray-500">No applications yet.</p>}
        </div>
      )}
    </div>
  );
}