import React, { useState } from 'react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Login failed');
      const json = await res.json();
      localStorage.setItem('token', json.accessToken);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Login error');
    }
  }

  return (
    <div className="card max-w-md">
      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="w-full px-3 py-2 border rounded" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input className="w-full px-3 py-2 border rounded" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Login</button>
        </div>
        {error && <div className="text-red-600 mt-3">{error}</div>}
      </form>
    </div>
  );
}
