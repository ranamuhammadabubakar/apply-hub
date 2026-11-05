import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Only allow returning to pages on this site, never to another website
function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function Auth() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate(next || '/profile', { replace: true });
      } else {
        await register(form.name, form.email, form.password);
        // New students add their marks first, then return to where they were
        navigate(next ? `/profile?next=${encodeURIComponent(next)}` : '/profile', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto bg-white p-6 rounded-xl shadow space-y-3">
      <h2 className="text-2xl font-semibold">{mode === 'login' ? 'Login' : 'Create a free account'}</h2>
      {next && (
        <p className="text-sm text-gray-600">
          {mode === 'login'
            ? 'Log in to see your chance of admission and track your applications.'
            : 'It takes a minute. Then add your marks to see your chance for every program.'}
        </p>
      )}
      {mode === 'register' && (
        <input className="w-full border rounded p-2" placeholder="Full name" value={form.name} onChange={set('name')} required />
      )}
      <input className="w-full border rounded p-2" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
      <input className="w-full border rounded p-2" type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set('password')} required />
      {mode === 'login' && (
        <Link to="/forgot-password" className="block text-sm text-indigo-700 text-right">
          Forgot password?
        </Link>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button disabled={busy} className="w-full bg-indigo-700 text-white py-2 rounded disabled:opacity-60">
        {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
      </button>
      <button type="button" className="text-sm text-indigo-700" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Create a new account' : 'Already have an account? Login'}
      </button>
    </form>
  );
}