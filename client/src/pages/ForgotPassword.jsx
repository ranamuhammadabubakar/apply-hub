import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null); // { text, ok }
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const d = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg({ text: d.message, ok: true });
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto bg-white p-6 rounded-xl shadow space-y-3">
      <h2 className="text-2xl font-semibold">Forgot password</h2>
      <p className="text-sm text-gray-500">Enter your email and we will send you a link to reset your password.</p>
      <input
        className="w-full border rounded p-2"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      <button disabled={busy} className="w-full bg-indigo-700 text-white py-2 rounded disabled:opacity-60">
        {busy ? 'Sending...' : 'Send reset link'}
      </button>
      <Link to="/login" className="block text-sm text-indigo-700">Back to login</Link>
    </form>
  );
}