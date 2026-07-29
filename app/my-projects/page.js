"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

const ROLE_COLOR = {
  account_manager: { border: '#7c3aed', text: '#6d28d9', bg: '#f5f3ff' },
  manager:         { border: '#1a3a8f', text: '#1d4ed8', bg: '#eff6ff' },
  staff:           { border: '#64748b', text: '#475569', bg: '#f8fafc' },
};
const ROLE_LABELS = { account_manager: 'Account Manager', manager: 'Manager', staff: 'Staff' };

function initialsOf(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || '?';
}

function RolePill({ role }) {
  const c = ROLE_COLOR[role] || ROLE_COLOR.staff;
  return (
    <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ borderColor: c.border, color: c.text, background: c.bg }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function Avatar({ name, role }) {
  const c = ROLE_COLOR[role] || ROLE_COLOR.staff;
  return (
    <div className="flex items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
      style={{ width: 34, height: 34, background: c.border }}>
      {initialsOf(name)}
    </div>
  );
}

export default function MyProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoMissing, setLogoMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('am_portal_user');
      if (!stored) { router.push('/'); return; }
      setUser(JSON.parse(stored));
    } catch { router.push('/'); }
  }, [router]);

  const fetchProjects = useCallback(async (uid) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/account-manager/${uid}/my-projects`);
      const data = res.data?.data || [];
      setProjects(data);
      // Auto-expand all projects initially
      const exp = {};
      data.forEach((p) => { exp[p.project_code] = true; });
      setExpandedProjects(exp);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.user_id) fetchProjects(user.user_id); }, [user?.user_id, fetchProjects]);

  const stats = useMemo(() => {
    const allMembers = projects.flatMap((p) => p.members || []);
    const uniqueIds = new Set(allMembers.map((m) => m.user_id));
    const managers = new Set(allMembers.filter((m) => m.project_role === 'manager').map((m) => m.user_id));
    const staff    = new Set(allMembers.filter((m) => m.project_role === 'staff').map((m) => m.user_id));
    return { projects: projects.length, total: uniqueIds.size, managers: managers.size, staff: staff.size };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) =>
      (!q || (p.project_code + ' ' + p.project_name).toLowerCase().includes(q)) &&
      (p.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'
    );
  }, [projects, search]);

  const displayName = user?.full_name || 'Account Manager';

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading your projects…</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Account Manager Dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-950">My Projects</h1>
          <p className="mt-2 text-sm text-slate-500">
            Overview of all projects you manage, including team composition and project roles.
          </p>
        </div>
        <div className="hidden md:block">
          {!logoMissing ? (
            <Image src="/nextan-logo.png" alt="Nextan" width={140} height={46} className="h-auto w-full max-w-[140px] object-contain" priority onError={() => setLogoMissing(true)} />
          ) : null}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Projects',  value: stats.projects, color: 'text-purple-700' },
          { label: 'Total Members', value: stats.total,    color: 'text-slate-800'  },
          { label: 'Managers',  value: stats.managers, color: 'text-blue-700'   },
          { label: 'Staff',     value: stats.staff,    color: 'text-slate-600'  },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{s.label}</p>
            <p className={`mt-3 text-4xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="flex gap-1.5">
          {['all', 'manager', 'staff'].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${roleFilter === r ? 'bg-[#1a3a8f] text-white border-[#1a3a8f]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {r === 'all' ? 'All roles' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <button onClick={() => fetchProjects(user?.user_id)}
          className="ml-auto rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          ↻ Refresh
        </button>
      </div>

      {/* Project cards */}
      {filteredProjects.length === 0 ? (
        <p className="text-sm text-slate-400 py-8">No projects found.</p>
      ) : (
        <div className="space-y-5">
          {filteredProjects.map((p) => {
            const expanded = !!expandedProjects[p.project_code];
            const members = (p.members || []).filter((m) => roleFilter === 'all' || m.project_role === roleFilter);
            const byRole = {
              manager: members.filter((m) => m.project_role === 'manager'),
              staff:   members.filter((m) => m.project_role === 'staff'),
              other:   members.filter((m) => !['manager', 'staff'].includes(m.project_role)),
            };

            return (
              <div key={p.project_code} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Project header */}
                <button type="button" onClick={() => setExpandedProjects((prev) => ({ ...prev, [p.project_code]: !prev[p.project_code] }))}
                  className="w-full flex items-center justify-between px-6 py-5 border-b border-slate-100 hover:bg-slate-50 transition text-left"
                  style={{ background: '#f0f4ff' }}>
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl px-3 py-1.5 text-sm font-bold text-white" style={{ background: '#1a3a8f' }}>
                      {p.project_code}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{p.project_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.budget_hours} hrs budget · {(p.members || []).length} members</p>
                    </div>
                  </div>
                  <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
                </button>

                {/* Team members grouped by project role */}
                {expanded && (
                  <div className="p-6 space-y-6">
                    {byRole.manager.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                          Managers ({byRole.manager.length})
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {byRole.manager.map((m) => (
                            <div key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:shadow-sm transition">
                              <Avatar name={m.full_name} role="manager" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">{m.full_name}</p>
                                <p className="text-xs text-slate-400 truncate">{m.email}</p>
                              </div>
                              <RolePill role={m.project_role || 'staff'} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {byRole.staff.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                          Staff ({byRole.staff.length})
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {byRole.staff.map((m) => (
                            <div key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:shadow-sm transition">
                              <Avatar name={m.full_name} role="staff" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">{m.full_name}</p>
                                <p className="text-xs text-slate-400 truncate">{m.email}</p>
                              </div>
                              <RolePill role={m.project_role || 'staff'} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {byRole.other.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Other</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {byRole.other.map((m) => (
                            <div key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <Avatar name={m.full_name} role="staff" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">{m.full_name}</p>
                                <p className="text-xs text-slate-400 truncate">{m.email}</p>
                              </div>
                              <RolePill role={m.project_role || 'staff'} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {members.length === 0 && (
                      <p className="text-sm text-slate-400 italic">No members match the selected role filter.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
