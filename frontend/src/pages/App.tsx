import React, { useState } from 'react';
import Scanner from './Scanner';
import Login from './Login';
import Invitations from './Invitations';

export default function App() {
  const [page, setPage] = useState<'home' | 'scanner' | 'login' | 'invitations'>('home');

  return (
    <div className="container">
      <div className="p-6">
      <h1 className="text-2xl font-semibold mb-3">Corporate Invitations</h1>
      <div className="mb-3 space-x-2">
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setPage('home')}>Home</button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setPage('scanner')}>Scanner</button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setPage('invitations')}>Invitations</button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setPage('login')}>Login</button>
      </div>
      {page === 'home' && <p className="text-slate-700">Admin dashboard and scanner will be available here.</p>}
      {page === 'scanner' && <Scanner />}
      {page === 'invitations' && <Invitations />} 
      {page === 'login' && <Login onLogin={() => setPage('home')} />}
      </div>
    </div>
  );
}
