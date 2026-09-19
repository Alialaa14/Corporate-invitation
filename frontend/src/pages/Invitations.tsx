import React, { useEffect, useState } from 'react';

type Invitation = any;

export default function Invitations() {
  const [data, setData] = useState<Invitation[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/invitations?page=${page}&limit=${limit}`);
    const json = await res.json();
    setData(json.data);
    setTotalPages(json.meta.totalPages || 1);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page]);

  async function handleExport() {
    const res = await fetch(`/api/invitations/export?page=${page}&limit=${limit}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invitations.csv';
    a.click();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('eventId', '');
    const res = await fetch('/api/invitations/import', { method: 'POST', body: form });
    const json = await res.json();
    setJobId(json.jobId);
  }

  return (
    <div className="card">
      <h2 className="text-xl font-medium mb-3">Invitations</h2>
      <div className="mb-3 flex items-center gap-3">
        <button className="px-3 py-2 bg-slate-700 text-white rounded" onClick={handleExport}>Export</button>
        <form onSubmit={handleImport} className="flex items-center gap-2">
          <input className="px-2 py-1 border rounded" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="px-3 py-2 bg-blue-600 text-white rounded" type="submit">Import</button>
        </form>
      </div>

      {loading ? <div className="notice">Loading...</div> : (
        <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="text-left text-sm text-slate-600">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row.id} className="border-b">
                <td className="px-4 py-3">{row.fullName}</td>
                <td className="px-4 py-3">{row.company}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">{row.phone}</td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">{row.attendanceStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button className="px-3 py-2 bg-slate-200 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span className="text-sm">{page} / {totalPages}</span>
        <button className="px-3 py-2 bg-slate-200 rounded" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>

      {jobId && <div className="notice mt-3">Import job submitted: {jobId}</div>}
    </div>
  );
}
