import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const { login, register, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo() {
    setError('');
    setBusy(true);
    try {
      await demoLogin();
      navigate('/recommendations'); // show the most impressive page first
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="font-semibold text-indigo-900">Just looking around?</p>
        <p className="text-sm text-indigo-800 mb-3">
          Try Apply Hub as a demo student. No sign-up needed.
        </p>
        <button
          type="button"
          onClick={tryDemo}
          disabled={busy}
          className="w-full bg-white border border-indigo-700 text-indigo-700 py-2 rounded hover:bg-indigo-100 disabled:opacity-60"
        >
          {busy ? 'Please wait...' : 'Try demo as student'}
        </button>
      </div>

      <form onSubmit={submit} className="bg-white p-6 rounded-xl shadow space-y-3">
        <h2 className="text-2xl font-semibold">{mode === 'login' ? 'Login' : 'Create account'}</h2>
        {mode === 'register' && (
          <input className="w-full border rounded p-2" placeholder="Full name" value={form.name} onChange={set('name')} required />
        )}
        <input className="w-full border rounded p-2" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input className="w-full border rounded p-2" type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set('password')} required />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={busy} className="w-full bg-indigo-700 text-white py-2 rounded disabled:opacity-60">
          {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
        <button type="button" className="text-sm text-indigo-700" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Create a new account' : 'Already have an account? Login'}
        </button>
      </form>
    </div>
  );
}