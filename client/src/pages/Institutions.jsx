import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const TYPE_LABELS = {
  university: 'University',
  'medical-college': 'Medical college',
  school: 'School',
  academy: 'Academy',
};

const PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Azad Jammu & Kashmir',
  'Gilgit Baltistan',
];

const CHANCE_STYLES = {
  Safe: 'bg-green-100 text-green-800',
  'Good chance': 'bg-blue-100 text-blue-800',
  Reach: 'bg-orange-100 text-orange-800',
  Unlikely: 'bg-red-100 text-red-700',
  'Check merit': 'bg-gray-100 text-gray-700',
};

const isKnown = (value) => value !== null && value !== undefined;

// Same thresholds as the recommendations on the server
function chanceFor(marks, minPercentage) {
  if (!isKnown(minPercentage)) return 'Check merit';
  const margin = marks - minPercentage;
  if (margin >= 5) return 'Safe';
  if (margin >= 0) return 'Good chance';
  if (margin >= -5) return 'Reach';
  return 'Unlikely';
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const isPast = (value) => value && new Date(value) < new Date();

export default function Institutions() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  // A link like /institutions?province=Punjab opens with that province already selected
  const [province, setProvince] = useState(searchParams.get('province') || '');
  const [sector, setSector] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marks, setMarks] = useState(null); // the student's FSc %, when logged in

  // Where to come back to after logging in
  const returnTo = encodeURIComponent(location.pathname + location.search);
  const chanceLink = `/login?mode=register&next=${returnTo}`;

  // Load the student's marks once they are logged in
  useEffect(() => {
    if (!user) {
      setMarks(null);
      return;
    }
    api('/profile')
      .then((d) => setMarks(Number(d.profile?.percentage) || null))
      .catch(() => setMarks(null));
  }, [user]);

  // Go back to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [q, city, province, sector]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (province) params.set('province', province);
    if (sector) params.set('sector', sector);
    setLoading(true);
    const t = setTimeout(() => {
      api(`/institutions?${params}`)
        .then((d) => {
          setItems(d.items);
          setTotal(d.total);
          setPages(d.pages);
          setError('');
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, city, province, sector, page]);

  function goTo(p) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Institutions</h2>
      <p className="text-sm text-gray-500 mb-4">
        HEC recognised universities and PMDC recognised colleges. Admission details change every year, so always confirm
        merit, fees and deadlines on the official website.
      </p>

      {/* Chance information */}
      {!user && (
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="flex-1 min-w-60 text-sm text-indigo-900">
            <span className="font-semibold">Want to know if you can get in?</span> Create a free account and add your
            marks to see your chance for every program.
          </p>
          <Link to={chanceLink} className="bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded">
            See your chance
          </Link>
        </div>
      )}
      {user && !marks && (
        <p className="mb-4 text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-3">
          <Link to={`/profile?next=${returnTo}`} className="font-semibold underline">Add your FSc marks</Link> to see
          your chance for every program.
        </p>
      )}
      {user && marks && (
        <p className="mb-4 text-xs text-gray-500">
          Your chance is an estimate from your FSc marks ({marks}%). Final merit usually also includes an entry test.
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-2">
        <input className="border rounded p-2 flex-1 min-w-48" placeholder="Search by name, e.g. LUMS, FAST, UET Lahore" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="border rounded p-2 w-36" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <select className="border rounded p-2" value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="">All provinces</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className="border rounded p-2" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">Public and private</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
      <p className="text-xs text-gray-500 mb-4">{loading ? 'Loading...' : `${total} institutions found`}</p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

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
              {i.city}
              {i.province && i.province !== i.city ? `, ${i.province}` : ''} · {TYPE_LABELS[i.type] || i.type}
              {i.category ? ` · ${i.category}` : ''}
            </p>
            {i.description && <p className="text-sm text-gray-700 mt-1">{i.description}</p>}

            {i.programs.length > 0 ? (
              <ul className="mt-3 text-sm space-y-1">
                {i.programs.map((p) => {
                  const deadline = p.deadline || i.deadline;
                  const chance = marks ? chanceFor(marks, p.minPercentage) : null;
                  return (
                    <li key={p._id} className="border-t border-gray-100 pt-1">
                      <span className="font-medium">{p.name}</span>
                      {chance && (
                        <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded align-middle ${CHANCE_STYLES[chance]}`}>
                          {chance}
                        </span>
                      )}
                      {p.accreditedBy && (
                        <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 align-middle">
                          {p.accreditedBy} accredited
                        </span>
                      )}
                      <span className="text-gray-600">
                        {' '}· {isKnown(p.minPercentage) ? `min ${p.minPercentage}%` : 'merit not published'}
                        {' '}· {isKnown(p.feePerYear) ? `PKR ${p.feePerYear.toLocaleString('en-US')}/yr` : 'fee not published'}
                      </span>
                      {deadline && (
                        <span className={isPast(deadline) ? 'text-red-600' : 'text-gray-600'}>
                          {' '}· {isPast(deadline) ? 'Closed' : `Apply by ${formatDate(deadline)}`}
                        </span>
                      )}
                      {!user && isKnown(p.minPercentage) && (
                        <Link to={chanceLink} className="ml-1.5 text-xs text-indigo-700 underline">
                          See your chance
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                Program details are not added yet. Please check the official website.
              </p>
            )}

            <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
              {i.admissionUrl && (
                <a href={i.admissionUrl} target="_blank" rel="noreferrer" className="bg-indigo-700 text-white text-sm px-3 py-1.5 rounded">
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

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="border rounded px-3 py-1.5 bg-white disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {pages}
          </span>
          <button onClick={() => goTo(page + 1)} disabled={page >= pages} className="border rounded px-3 py-1.5 bg-white disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}