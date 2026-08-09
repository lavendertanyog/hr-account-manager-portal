"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const isAutoEntry = (summary) => String(summary || '').startsWith('Auto-progress baseline');

function formatSummary(log) {
  const pct = log.completion_percentage != null ? `${Number(log.completion_percentage).toFixed(0)}%` : '';
  if (isAutoEntry(log.progress_summary)) {
    return `Auto: Progress update: ${pct}`;
  }
  const remark = String(log.progress_summary || '').trim();
  const isDefaultRemark = remark === `Progress update: ${pct}` || remark === '';
  return isDefaultRemark ? 'Manual' : `Manual: ${remark}`;
}

export default function ProjectCodesPage() {
  const [projects, setProjects] = useState([]);
  const [utilisationMap, setUtilisationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);

  // Project table filters
  const [projectStatusFilter, setProjectStatusFilter] = useState('ALL');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectPage, setProjectPage] = useState(1);

  // Progress log state
  const [progressLogs, setProgressLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [logsPage, setLogsPage] = useState(1);

  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('am_portal_user') || '{}');
      if (u?.user_id) setSessionUser(u);
    } catch {}
  }, []);

  const managerId = sessionUser?.user_id || '';

  const fetchAll = async () => {
    try {
      const [res, utilRes] = await Promise.all([
        axios.get(`${backendBaseUrl}/api/v1/projects`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/projects/utilisation-detail`).catch(() => ({ data: { data: [] } })),
      ]);
      setProjects(res.data.data || []);
      const utilMap = {};
      (utilRes.data.data || []).forEach((u) => { utilMap[u.project_code] = Number(u.weighted_utilisation_pct || 0); });
      setUtilisationMap(utilMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!managerId) return;
    setLogsLoading(true);
    try {
      const res = await axios.get(`${backendBaseUrl}/api/v1/manager/${managerId}/progress-logs`).catch(() => ({ data: { data: [] } }));
      setProgressLogs(res.data.data || []);
    } catch {
      setProgressLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => { void fetchAll(); }, [backendBaseUrl]);
  useEffect(() => { void fetchLogs(); }, [managerId]);

  const resetProjectFilters = () => {
    setProjectStatusFilter('ALL'); setProjectSearch(''); setProjectPage(1);
  };

  const filteredProjects = projects.filter((p) => {
    const statusOk = projectStatusFilter === 'ALL' || (p.status || 'ACTIVE').toUpperCase() === projectStatusFilter;
    const q = projectSearch.trim().toLowerCase();
    const searchOk = !q || (p.project_code || '').toLowerCase().includes(q) || (p.project_name || '').toLowerCase().includes(q) || (p.account_manager_name || '').toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  const filteredLogs = progressLogs.filter((log) => {
    const dateMatch = !filterDate || String(log.logged_at || '').slice(0, 10) === filterDate;
    const nameMatch = !filterName || (log.reporter_name || log.reporter_email || '').toLowerCase().includes(filterName.toLowerCase());
    const codeMatch = !filterCode || (log.project_code || '').toLowerCase().includes(filterCode.toLowerCase());
    return dateMatch && nameMatch && codeMatch;
  });

  const exportCSV = () => {
    const headers = ['Date', 'Staff Name', 'Project Code', 'Completion %', 'Source', 'Summary'];
    const rows = filteredLogs.map((l) => [
      String(l.logged_at || '').slice(0, 10),
      l.reporter_name || l.reporter_email || '',
      l.project_code || '',
      l.completion_percentage ?? '',
      isAutoEntry(l.progress_summary) ? 'Auto' : 'Manual',
      `"${String(l.progress_summary || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mt-2 text-4xl font-semibold text-slate-950">Progress</h1>
        <p className="mt-1 text-sm text-slate-500">Active project codes and team progress logs.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm mb-10 overflow-hidden">
        {/* Project codes toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-100">
          {['ALL', 'ACTIVE', 'INACTIVE'].map((f) => (
            <button key={f} onClick={() => setProjectStatusFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                projectStatusFilter === f ? 'bg-[#1540A8] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
          <input
            type="text"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Search code, name or manager..."
            className="rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          {(projectStatusFilter !== 'ALL' || projectSearch) && (
            <button onClick={resetProjectFilters}
              className="rounded-2xl border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              Reset Filters
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-[0.22em] text-[0.70rem]">
            <tr>
              <th className="px-6 py-4">Code ID</th>
              <th className="px-6 py-4">Project Name</th>
              <th className="px-6 py-4">Hours</th>
              <th className="px-6 py-4">Utilization</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Manager</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading project codes...</td></tr>
            ) : (() => {
              if (filteredProjects.length === 0) return <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No project codes found.</td></tr>;
              const totalPages = Math.max(1, Math.ceil(filteredProjects.length / 6));
              const safePage = Math.min(projectPage, totalPages);
              const start = (safePage - 1) * 6;
              const page = filteredProjects.slice(start, start + 6);
              return (
                <>
                  {page.map((project) => {
                    const hours = project.budget_hours ?? 0;
                    const utilization = utilisationMap[project.project_code] != null && !isNaN(Number(utilisationMap[project.project_code])) ? Number(utilisationMap[project.project_code]) : (Number(project.budget_hours) > 0 ? Math.round(((project.total_tracked_hours ?? 0) / Number(project.budget_hours)) * 100) : 0);
                    const managerDisplay = project.account_manager_name || 'N/A';
                    const isInactive = (project.status || '').toUpperCase() === 'INACTIVE';
                    return (
                      <tr key={project.project_code} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{project.project_code}</td>
                        <td className="px-6 py-4 text-slate-700">{project.project_name}</td>
                        <td className="px-6 py-4 text-slate-700">{hours} hrs</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full bg-[#163EAF]" style={{ width: `${Math.min(Math.max(utilization, 0), 100)}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{utilization}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isInactive ? 'bg-red-100 text-red-700' : 'bg-[#E8EEFF] text-[#163EAF]'
                          }`}>{project.status ?? 'Active'}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 max-w-[180px] truncate">{managerDisplay}</td>
                      </tr>
                    );
                  })}
                  {totalPages > 1 && (
                    <tr><td colSpan={6} className="px-6 py-3 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Showing {start + 1}–{Math.min(start + 6, filteredProjects.length)} of {filteredProjects.length}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setProjectPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                            className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">Prev</button>
                          <button onClick={() => setProjectPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                            className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">Next</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
        </div>
      </div>

      {/* Progress Logs section */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-slate-950">Progress Logs</h2>
          <p className="mt-1 text-sm text-slate-500">Team progress submissions — filter and export as needed.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter by staff name..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
          <input
            type="text"
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            placeholder="Filter by project code..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
          {(filterDate || filterName || filterCode) && (
            <button
              onClick={() => { setFilterDate(''); setFilterName(''); setFilterCode(''); setLogsPage(1); }}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          )}
          <button
            onClick={exportCSV}
            className="ml-auto rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-[0.22em] text-[0.70rem]">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Staff Name</th>
                <th className="px-6 py-4">Project Code</th>
                <th className="px-6 py-4">Completion %</th>
                <th className="px-6 py-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logsLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading progress logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No progress logs found.</td></tr>
              ) : (() => {
                const totalPages = Math.max(1, Math.ceil(filteredLogs.length / 6));
                const safePage = Math.min(logsPage, totalPages);
                const start = (safePage - 1) * 6;
                const page = filteredLogs.slice(start, start + 6);
                return (
                  <>
                    {page.map((log, idx) => (
                      <tr key={log.log_id || idx} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-700">{String(log.logged_at || '').slice(0, 10)}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{log.reporter_name || log.reporter_email || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#E8EEFF] px-3 py-1 text-xs font-semibold text-[#163EAF]">{log.project_code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full bg-[#163EAF]" style={{ width: `${Math.min(Math.max(Number(log.completion_percentage) || 0, 0), 100)}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{log.completion_percentage ?? 0}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{formatSummary(log)}</td>
                      </tr>
                    ))}
                    {totalPages > 1 && (
                      <tr><td colSpan={5} className="px-6 py-3 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Showing {start + 1}–{Math.min(start + 6, filteredLogs.length)} of {filteredLogs.length}</span>
                          <div className="flex gap-2">
                            <button onClick={() => setLogsPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">Prev</button>
                            <button onClick={() => setLogsPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">Next</button>
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
