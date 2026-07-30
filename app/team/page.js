"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';

function formatDt(dt) {
  if (!dt) return 'ACTIVE';
  return new Date(dt).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' });
}

function UserMultiSelect({ label, placeholder, users, selected, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => (u.full_name + ' ' + u.email).toLowerCase().includes(q)) : users;
  }, [users, search]);
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const selectedUsers = users.filter((u) => selected.includes(u.user_id));
  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedUsers.map((u) => (
            <span key={u.user_id} className="flex items-center gap-1 rounded-full bg-[#E8EEFF] px-3 py-1 text-xs font-semibold text-[#1540A8]">
              {u.full_name}
              <button type="button" onClick={() => toggle(u.user_id)} className="ml-0.5 leading-none hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
      )}
      <input type="text" value={search} onFocus={() => setOpen(true)}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 ? <p className="px-4 py-3 text-sm text-slate-400">No results</p>
            : filtered.map((u) => {
              const sel = selected.includes(u.user_id);
              return (
                <button key={u.user_id} type="button" onClick={() => toggle(u.user_id)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${sel ? 'bg-[#E8EEFF]' : ''}`}>
                  <span className="font-medium text-slate-800">{u.full_name}</span>
                  <span className="text-xs text-slate-400">{u.email}</span>
                  {sel && <span className="ml-2 text-[#1540A8] font-bold">&#10003;</span>}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [managerId, setManagerId] = useState('');
  const [allStaff, setAllStaff] = useState([]);
  const [myTeam, setMyTeam] = useState([]);
  const [projects, setProjects] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [progressLogs, setProgressLogs] = useState([]);
  const [teamAssignments, setTeamAssignments] = useState([]);
  const [myProjects, setMyProjects] = useState([]);

  const [teamSearch, setTeamSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [selectedAddIds, setSelectedAddIds] = useState([]);
  const [teamMsg, setTeamMsg] = useState('');
  const [teamSubmitting, setTeamSubmitting] = useState(false);

  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [assignProjectCode, setAssignProjectCode] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignFeedback, setAssignFeedback] = useState('');
  const [unassignFeedback, setUnassignFeedback] = useState('');

  const [loading, setLoading] = useState(true);
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('am_portal_user') || '{}');
      if (u?.user_id) setManagerId(u.user_id);
    } catch {}
  }, []);

  const fetchData = useCallback(async (mid) => {
    if (!mid) return;
    try {
      const [staffRes, projectsRes, attendRes, progressRes, assignmentsRes, myProjectsRes] = await Promise.all([
        axios.get(`${backendBaseUrl}/api/v1/users`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/projects`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/manager/${mid}/attendance-logs`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/manager/${mid}/progress-logs`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/manager/${mid}/team-assignments`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/manager/${mid}/my-projects`).catch(() => ({ data: { data: [] } })),
      ]);
      // Multi-role aware: include users who have 'staff' in their user_roles array OR as their primary user_role
      const all = (staffRes.data.data || []).filter((u) => {
        const roles = Array.isArray(u.user_roles) && u.user_roles.length > 0
          ? u.user_roles : [u.user_role];
        return roles.some((r) => String(r || '').toLowerCase() === 'staff');
      });
      setAllStaff(all);
      setMyTeam(all.filter((s) => String(s.supervisor_id || '') === mid));
      setProjects(projectsRes.data.data || []);
      setAttendanceLogs(attendRes.data.data || []);
      setProgressLogs(progressRes.data.data || []);
      setTeamAssignments(assignmentsRes.data.data || []);
      setMyProjects(myProjectsRes.data.data || []);
    } catch (err) {
      console.error('Team fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [backendBaseUrl]);

  useEffect(() => {
    if (!managerId) return;
    fetchData(managerId);
    const timer = setInterval(() => fetchData(managerId), 15000);
    return () => clearInterval(timer);
  }, [managerId, fetchData]);

  const handleAddToTeam = async () => {
    if (selectedAddIds.length === 0) { setTeamMsg('Select at least one staff member to add.'); return; }
    setTeamSubmitting(true); setTeamMsg('');
    try {
      await axios.patch(`${backendBaseUrl}/api/v1/users/set-supervisor`, { managerId, staffIds: selectedAddIds });
      setTeamMsg(`${selectedAddIds.length} staff member(s) added to your team.`);
      setSelectedAddIds([]);
      await fetchData(managerId);
    } catch (err) {
      setTeamMsg(err.response?.data?.error || 'Failed to add staff.');
    } finally { setTeamSubmitting(false); }
  };

  const handleRemoveFromTeam = async (staffId) => {
    setTeamMsg('');
    try {
      await axios.patch(`${backendBaseUrl}/api/v1/users/remove-from-team`, { managerId, staffId });
      setTeamMsg('Staff member removed.');
      await fetchData(managerId);
    } catch (err) { setTeamMsg(err.response?.data?.error || 'Failed to remove.'); }
  };

  const handleAssignStaff = async (e) => {
    e.preventDefault(); setAssignFeedback('');
    if (selectedStaffIds.length === 0 || !assignProjectCode) {
      setAssignFeedback('Select at least one staff member and a project code.'); return;
    }
    setAssignLoading(true);
    try {
      await axios.post(`${backendBaseUrl}/api/v1/projects/assign-bulk`, {
        managerId, userIds: selectedStaffIds, projectCode: assignProjectCode,
      });
      setAssignFeedback(`${selectedStaffIds.length} staff assigned to ${assignProjectCode}.`);
      setSelectedStaffIds([]); setAssignProjectCode('');
    } catch (err) {
      setAssignFeedback(err.response?.data?.error || 'Assignment failed.');
    } finally { setAssignLoading(false); }
  };

  const handleUnassignProject = async (userId, projectCode) => {
    const confirmed = window.confirm(`Remove the ${projectCode} project assignment for this staff member?`);
    if (!confirmed) return;
    setUnassignFeedback('');
    try {
      await axios.delete(`${backendBaseUrl}/api/v1/assignments/remove`, {
        data: { managerId, userId, projectCode },
      });
      setUnassignFeedback(`Removed ${projectCode} assignment.`);
      await fetchData(managerId);
    } catch (err) { setUnassignFeedback(err.response?.data?.error || 'Failed to unassign.'); }
  };

  const unlinkedStaff = allStaff.filter((s) => String(s.supervisor_id || '') !== managerId);

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="mt-2 text-4xl font-semibold text-slate-950">Team Management</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your direct reports and assign staff to projects.</p>
      </div>

      {/* Projects this manager/AM is in charge of, as assigned by HR */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-3">You Are In Charge Of</p>
        {myProjects.filter((p) => (p.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length === 0 ? (
          <p className="text-sm text-slate-400 italic">No projects assigned to you yet. Contact HR to be assigned as manager or account manager on a project.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myProjects.filter((p) => (p.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').map((p) => (
              <span key={p.project_code}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EEFF] px-3 py-1.5 text-xs font-semibold text-[#1540A8]">
                {p.project_code} — {p.project_name}
                <span className="opacity-60">· {p.my_role === 'account_manager' ? 'AM' : 'Manager'}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Team composition: Current Members + Add Staff, grouped before project allocation workflows */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Current Members card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Current Members</h2>
            <p className="text-sm text-slate-500 mt-0.5">View and remove direct reports from your team.</p>
          </div>

          {teamMsg && (
            <p className={`text-sm font-medium ${teamMsg.includes('Failed') || teamMsg.includes('Select') || teamMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{teamMsg}</p>
          )}

          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{myTeam.length} member{myTeam.length !== 1 ? 's' : ''}</p>
            <input type="text" placeholder="Search..." value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
          </div>
          {loading ? <p className="text-sm text-slate-500">Loading...</p>
            : myTeam.length === 0 ? <p className="text-sm text-slate-400 italic">No staff linked yet.</p>
            : (
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                {myTeam.filter((s) => {
                  const q = teamSearch.trim().toLowerCase();
                  return !q || (s.full_name + ' ' + s.email).toLowerCase().includes(q);
                }).map((s) => (
                  <div key={s.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.full_name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                    <button onClick={() => handleRemoveFromTeam(s.user_id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 shrink-0">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
        </section>

        {/* Add Staff card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-950">Add Staff</h2>
            <p className="text-sm text-slate-500 mt-0.5">Link unassigned staff members to your team.</p>
          </div>
          {teamMsg && (
            <p className={`mb-3 text-sm font-medium ${teamMsg.includes('Failed') || teamMsg.includes('Select') || teamMsg.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>{teamMsg}</p>
          )}
          <input type="text" placeholder="Search unlinked staff..." value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            className="mb-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid gap-1.5 sm:grid-cols-2 max-h-44 overflow-y-auto pr-0.5 mb-4">
            {unlinkedStaff.filter((s) => {
              const q = addSearch.trim().toLowerCase();
              return !q || (s.full_name + ' ' + s.email).toLowerCase().includes(q);
            }).map((s) => {
              const isSel = selectedAddIds.includes(s.user_id);
              return (
                <button key={s.user_id} type="button"
                  onClick={() => setSelectedAddIds((p) => p.includes(s.user_id) ? p.filter((x) => x !== s.user_id) : [...p, s.user_id])}
                  className={`flex flex-col rounded-2xl border px-3 py-2 text-left text-sm transition ${isSel ? 'border-blue-300 bg-[#E8EEFF]' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                  <p className="font-semibold text-slate-800 text-xs">{s.full_name}</p>
                  <p className="text-xs text-slate-400">{s.email}</p>
                </button>
              );
            })}
            {unlinkedStaff.length === 0 && <p className="text-xs text-slate-400 col-span-full">All staff are in your team.</p>}
          </div>
          <button onClick={handleAddToTeam} disabled={teamSubmitting || selectedAddIds.length === 0}
            className="mt-auto rounded-2xl bg-[#1540A8] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {teamSubmitting ? 'Saving...' : `Add ${selectedAddIds.length > 0 ? selectedAddIds.length + ' ' : ''}Selected`}
          </button>
        </section>
      </div>

      {/* Project allocation workflows: assign staff to project codes + review current assignments */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950 mb-1">Assign Staff to Project</h2>
        <p className="text-sm text-slate-500 mb-4">Assign one or more staff members to a project code.</p>
        <form onSubmit={handleAssignStaff} className="space-y-4 max-w-lg">
          <UserMultiSelect label="Staff Members" placeholder="Search staff by name or email..."
            users={allStaff} selected={selectedStaffIds} onChange={setSelectedStaffIds} />
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Project Code</label>
            <select value={assignProjectCode} onChange={(e) => setAssignProjectCode(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a project code</option>
              {projects.filter((p) => (p.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').map((p) => (
                <option key={p.project_code} value={p.project_code}>{p.project_code} — {p.project_name}</option>
              ))}
            </select>
          </div>
          {assignFeedback && (
            <p className={`text-sm font-medium ${assignFeedback.includes('assigned') ? 'text-green-600' : 'text-red-500'}`}>{assignFeedback}</p>
          )}
          <button type="submit" disabled={assignLoading}
            className="rounded-2xl bg-[#1540A8] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {assignLoading ? 'Assigning...' : 'Assign Project'}
          </button>
        </form>
      </section>

      {/* Staff–Project Assignment Analysis */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950 mb-1">Staff Project Assignments</h2>
        <p className="text-sm text-slate-500 mb-4">Overview of which staff member is assigned to which project code. Click × to remove an assignment.</p>
        {unassignFeedback && (
          <p className={`mb-3 text-sm font-medium ${unassignFeedback.includes('Removed') ? 'text-green-600' : 'text-red-500'}`}>{unassignFeedback}</p>
        )}
        {teamAssignments.length === 0 ? (
          <p className="text-sm text-slate-500">No project assignments found for your team.</p>
        ) : (() => {
          // Group by staff member
          const byStaff = {};
          teamAssignments.forEach((row) => {
            if (!byStaff[row.user_id]) byStaff[row.user_id] = { userId: row.user_id, name: row.full_name, email: row.email, projects: [] };
            if (row.project_code) {
              byStaff[row.user_id].projects.push({
                code: row.project_code,
                name: row.project_name,
                status: row.project_status,
                progress: row.latest_progress,
              });
            }
          });
          return (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
              {Object.values(byStaff).map((staff) => (
                <div key={staff.email} className="px-5 py-4 bg-white hover:bg-slate-50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#E8EEFF] flex items-center justify-center text-xs font-bold text-[#1540A8]">
                      {staff.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{staff.name}</p>
                      <p className="text-xs text-slate-400">{staff.email}</p>
                    </div>
                  </div>
                  {staff.projects.length === 0 ? (
                    <p className="text-xs text-slate-400 ml-11 italic">No project assignments</p>
                  ) : (
                    <div className="ml-11 flex flex-wrap gap-2">
                      {staff.projects.map((p) => (
                        <span key={p.code} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          (p.status || '').toUpperCase() === 'INACTIVE' ? 'bg-red-50 text-red-600' : 'bg-[#E8EEFF] text-[#1540A8]'
                        }`}>
                          {p.code}
                          {p.progress != null && <span className="opacity-70">· {p.progress}%</span>}
                          <button type="button"
                            onClick={() => handleUnassignProject(staff.userId, p.code)}
                            title={`Remove ${p.code} assignment`}
                            className="ml-0.5 hover:text-red-500 font-bold leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
