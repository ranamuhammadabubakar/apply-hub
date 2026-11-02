import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null); // { text, ok }
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (password !== confirm) {
      setMsg({ text: 'The two passwords do not match', ok: false });
      return;
    }
    setBusy(true);
    try {
      const d = await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setMsg({ text: d.message, ok: true });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto bg-white p-6 rounded-xl shadow space-y-3">
        <p>This reset link is not valid.</p>
        <Link to="/forgot-password" className="text-indigo-700 underline">Request a new link</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto bg-white p-6 rounded-xl shadow space-y-3">
      <h2 className="text-2xl font-semibold">Choose a new password</h2>
      <input
        className="w-full border rounded p-2"
        type="password"
        placeholder="New password (min 6 characters)"
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        className="w-full border rounded p-2"
        type="password"
        placeholder="Confirm new password"
        minLength={6}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      <button disabled={busy} className="w-full bg-indigo-700 text-white py-2 rounded disabled:opacity-60">
        {busy ? 'Saving...' : 'Update password'}
      </button>
    </form>
  );
}