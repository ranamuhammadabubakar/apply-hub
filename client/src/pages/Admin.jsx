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

const isKnown = (value) => value !== null && value !== undefined;
const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Empty -> null (not published); otherwise a number
function toNumberOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Program line: Name | field | min % | fee per year | deadline (optional, YYYY-MM-DD)
// An empty min % or fee means "not published yet".
const programsToText = (programs = []) =>
  programs
    .map((p) => {
      const parts = [
        p.name,
        p.field,
        isKnown(p.minPercentage) ? p.minPercentage : '',
        isKnown(p.feePerYear) ? p.feePerYear : '',
      ];
      if (p.deadline) parts.push(toDateInput(p.deadline));
      return parts.join(' | ');
    })
    .join('\n');

// originalPrograms keeps fields that are not in the text, such as accreditation and the source link
function textToPrograms(text, originalPrograms = []) {
  const byName = new Map(originalPrograms.map((p) => [p.name.toLowerCase(), p]));
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
      const original = byName.get(name.toLowerCase());
      return {
        name,
        field,
        minPercentage: toNumberOrNull(min),
        feePerYear: toNumberOrNull(fee),
        deadline: deadline || null,
        accreditedBy: original?.accreditedBy || null,
        sourceUrl: original?.sourceUrl || null,
      };
    });
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('institutions');
  const [institutions, setInstitutions] = useState([]);
  const [totalInstitutions, setTotalInstitutions] = useState(0);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingPrograms, setEditingPrograms] = useState([]);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  // AI extraction
  const [aiUrl, setAiUrl] = useState('');
  const [aiText, setAiText] = useState('');
  const [usePaste, setUsePaste] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState(null); // { sourceUrl, programs, institutionDeadline, notes }
  const [useAiDeadline, setUseAiDeadline] = useState(false);

  const isAdmin = user?.role === 'admin';

  async function loadInstitutions(query = search) {
    const params = new URLSearchParams({ limit: '50' });
    if (query) params.set('q', query);
    const d = await api(`/institutions?${params}`);
    setInstitutions(d.items);
    setTotalInstitutions(d.total);
  }

  async function loadApplications() {
    const d = await api('/applications');
    setApplications(d.items);
  }

  // Applications load once
  useEffect(() => {
    if (!isAdmin) return;
    loadApplications().catch((e) => setMsg(e.message));
  }, [isAdmin]);

  // Institutions reload whenever the search text changes (with a short delay while typing)
  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => {
      loadInstitutions(search).catch((e) => setMsg(e.message));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, search]);

  if (loading) return <p>Loading...</p>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function resetAi(url = '') {
    setAiUrl(url);
    setAiText('');
    setUsePaste(false);
    setAiError('');
    setAiResult(null);
    setUseAiDeadline(false);
  }

  function startEdit(i) {
    setEditingId(i._id);
    setEditingPrograms(i.programs || []);
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
    resetAi(i.admissionUrl || i.website || '');
    setMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setEditingPrograms([]);
    setForm(emptyForm);
    resetAi();
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
        programs: textToPrograms(form.programsText, editingPrograms),
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

  async function removeInstitution(i) {
    if (!window.confirm(`Delete "${i.name}"? Its applications will also be deleted.`)) return;
    try {
      const d = await api(`/institutions/${i._id}`, { method: 'DELETE' });
      setMsg(`Deleted "${i.name}" and ${d.deletedApplications || 0} related application(s).`);
      await loadInstitutions();
      await loadApplications();
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

  // ---------- AI extraction ----------

  async function fetchWithAi() {
    setAiError('');
    setAiResult(null);
    if (usePaste ? !aiText.trim() : !aiUrl.trim()) {
      setAiError(usePaste ? 'Please paste the page text first.' : 'Please enter the admission or fee page link.');
      return;
    }
    setAiBusy(true);
    try {
      const body = usePaste ? { text: aiText, url: aiUrl.trim() } : { url: aiUrl.trim() };
      const d = await api(`/institutions/${editingId}/extract`, { method: 'POST', body });
      setAiResult({ ...d, programs: d.programs.map((p) => ({ ...p, selected: true })) });
      setUseAiDeadline(Boolean(d.institutionDeadline) && !form.deadline);
      if (d.programs.length === 0) setAiError('No undergraduate programs were found on this page.');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  function updateAiProgram(index, key, value) {
    setAiResult((r) => ({
      ...r,
      programs: r.programs.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    }));
  }

  // Names already in the Programs box, to label each AI row as "New" or "Update"
  const currentNames = new Set(
    form.programsText
      .split('\n')
      .map((l) => l.split('|')[0].trim().toLowerCase())
      .filter(Boolean)
  );

  function applyAiResults() {
    let current;
    try {
      current = textToPrograms(form.programsText, editingPrograms);
    } catch (err) {
      setAiError(`Fix the Programs box first: ${err.message}`);
      return;
    }

    const byName = new Map(current.map((p) => [p.name.toLowerCase(), p]));
    let added = 0;
    let updated = 0;

    for (const p of aiResult.programs.filter((x) => x.selected)) {
      const name = String(p.name || '').trim();
      if (!name) continue;
      const values = {
        field: FIELDS.includes(p.field) ? p.field : 'other',
        minPercentage: toNumberOrNull(p.minPercentage),
        feePerYear: toNumberOrNull(p.feePerYear),
        deadline: p.deadline || null,
      };
      const existing = byName.get(name.toLowerCase());
      if (existing) {
        // Only fill in values the AI found; never wipe out what is already there
        for (const [key, value] of Object.entries(values)) {
          if (value !== null) existing[key] = value;
        }
        if (aiResult.sourceUrl) existing.sourceUrl = aiResult.sourceUrl;
        updated++;
      } else {
        const program = { name, ...values, accreditedBy: null, sourceUrl: aiResult.sourceUrl || null };
        current.push(program);
        byName.set(name.toLowerCase(), program);
        added++;
      }
    }

    setEditingPrograms(current);
    setForm((f) => ({
      ...f,
      programsText: programsToText(current),
      deadline: useAiDeadline && aiResult.institutionDeadline ? aiResult.institutionDeadline : f.deadline,
    }));
    setMsg(
      `${added} programs added and ${updated} updated in the Programs box. Check them, tick "verified" if they are correct, then press Update to save.`
    );
    setAiResult(null);
  }

  const tabBtn = (key, label) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded ${tab === key ? 'bg-indigo-700 text-white' : 'bg-white border'}`}
    >
      {label}
    </button>
  );

  const selectedCount = aiResult ? aiResult.programs.filter((p) => p.selected).length : 0;

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
            <h3 className="font-semibold">{editingId ? `Edit institution: ${form.name}` : 'Add institution'}</h3>
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

            {/* AI extraction: only for an institution that is already saved */}
            {editingId ? (
              <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="font-semibold text-indigo-900">Fetch programs with AI</p>
                  <p className="text-xs text-gray-600">
                    Use the official admission or fee page. The AI only suggests; nothing is saved until you press Update.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={!usePaste} onChange={() => setUsePaste(false)} /> Read a web page
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={usePaste} onChange={() => setUsePaste(true)} /> Paste text
                  </label>
                </div>

                <input
                  className="w-full border rounded p-2 bg-white"
                  placeholder="https://university.edu.pk/admissions/fee-structure"
                  value={aiUrl}
                  onChange={(e) => setAiUrl(e.target.value)}
                />
                {usePaste && (
                  <textarea
                    className="w-full border rounded p-2 bg-white text-sm"
                    rows="6"
                    placeholder="Open the page in your browser, select all the text (Ctrl + A), copy it and paste it here"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                  />
                )}

                <button
                  type="button"
                  onClick={fetchWithAi}
                  disabled={aiBusy}
                  className="bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {aiBusy ? 'Reading the page...' : 'Fetch with AI'}
                </button>
                {aiError && <p className="text-sm text-red-600">{aiError}</p>}

                {aiResult && aiResult.programs.length > 0 && (
                  <div className="space-y-3">
                    {aiResult.notes && <p className="text-sm text-gray-700"><span className="font-semibold">AI notes:</span> {aiResult.notes}</p>}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm bg-white border rounded">
                        <thead className="bg-gray-50 text-left">
                          <tr>
                            <th className="p-2">Use</th>
                            <th className="p-2">Program</th>
                            <th className="p-2">Field</th>
                            <th className="p-2">Merit %</th>
                            <th className="p-2">Fee per year</th>
                            <th className="p-2">Deadline</th>
                            <th className="p-2">Evidence from the page</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiResult.programs.map((p, i) => (
                            <tr key={i} className={`border-t align-top ${p.selected ? '' : 'opacity-50'}`}>
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={p.selected}
                                  onChange={(e) => updateAiProgram(i, 'selected', e.target.checked)}
                                  aria-label={`Use ${p.name}`}
                                />
                              </td>
                              <td className="p-2 min-w-48">
                                <input className="border rounded p-1 w-full" value={p.name} onChange={(e) => updateAiProgram(i, 'name', e.target.value)} />
                                <span className={`text-[11px] ${currentNames.has(p.name.trim().toLowerCase()) ? 'text-blue-700' : 'text-green-700'}`}>
                                  {currentNames.has(p.name.trim().toLowerCase()) ? 'Updates an existing program' : 'New program'}
                                </span>
                              </td>
                              <td className="p-2">
                                <select className="border rounded p-1" value={p.field} onChange={(e) => updateAiProgram(i, 'field', e.target.value)}>
                                  {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                                </select>
                              </td>
                              <td className="p-2">
                                <input className="border rounded p-1 w-20" value={p.minPercentage ?? ''} onChange={(e) => updateAiProgram(i, 'minPercentage', e.target.value)} />
                              </td>
                              <td className="p-2">
                                <input className="border rounded p-1 w-28" value={p.feePerYear ?? ''} onChange={(e) => updateAiProgram(i, 'feePerYear', e.target.value)} />
                              </td>
                              <td className="p-2">
                                <input className="border rounded p-1 w-32" type="date" value={p.deadline || ''} onChange={(e) => updateAiProgram(i, 'deadline', e.target.value)} />
                              </td>
                              <td className="p-2 text-xs text-gray-600 max-w-xs">{p.evidence || <span className="text-gray-400">No fee, merit or date found</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {aiResult.institutionDeadline && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={useAiDeadline} onChange={(e) => setUseAiDeadline(e.target.checked)} />
                        Use {formatDate(aiResult.institutionDeadline)} as the institution deadline
                      </label>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={applyAiResults}
                        disabled={selectedCount === 0}
                        className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
                      >
                        Add {selectedCount} selected to the list
                      </button>
                      <button type="button" onClick={() => setAiResult(null)} className="border px-4 py-2 rounded bg-white">
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Tip: after adding an institution, press Edit to fetch its programs with AI.</p>
            )}

            <label className="block text-sm">
              Programs, one per line: Name | field | min % | fee per year | deadline (optional)
              <textarea
                className="w-full border rounded p-2 mt-1 font-mono text-sm"
                rows="6"
                placeholder={'BS Computer Science | cs | 70 | 250000 | 2026-11-30'}
                value={form.programsText}
                onChange={set('programsText')}
              />
            </label>
            <p className="text-xs text-gray-500">
              Fields: {FIELDS.join(', ')}. Leave min % or fee empty if it is not published yet. Deadline format: YYYY-MM-DD.
            </p>
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

          <div className="space-y-2">
            <input
              className="border rounded p-2 w-full bg-white"
              placeholder="Search institutions by name (e.g. FAST, UET, NUST)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Showing {institutions.length} of {totalInstitutions} institutions
              {totalInstitutions > institutions.length ? '. Use search to find the rest.' : ''}
            </p>
          </div>

          <div className="space-y-3">
            {institutions.map((i) => (
              <div key={i._id} className="bg-white p-4 rounded-xl shadow flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-60">
                  <h3 className="font-semibold">{i.name}</h3>
                  <p className="text-sm text-gray-600">
                    {i.city} · {i.type} · {i.sector || 'private'} · {i.programs.length} programs
                    {i.source === 'hec' ? ' · from HEC' : ''}
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
                <button onClick={() => removeInstitution(i)} className="bg-red-600 text-white px-3 py-1 rounded">Delete</button>
              </div>
            ))}
            {institutions.length === 0 && <p className="text-gray-500">No institutions found.</p>}
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <div className="space-y-3">
          {applications.map((a) => (
            <div key={a._id} className="bg-white p-4 rounded-xl shadow flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-60">
                <h3 className="font-semibold">{a.program} — {a.institution?.name || 'Deleted institution'}</h3>
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