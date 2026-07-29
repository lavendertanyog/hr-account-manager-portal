"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

function formatHours(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function StatusPill({ status }) {
  const map = {
    APPROVED: 'bg-green-50 text-green-700',
    REJECTED: 'bg-red-50 text-red-600',
    PENDING: 'bg-yellow-50 text-yellow-700',
    MANAGER_APPROVED: 'bg-blue-50 text-blue-700',
  };
  const label = String(status || '').replace('_', ' ');
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>{label}</span>;
}

export default function AccountManagerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  // Hour allocations state
  const [allocations, setAllocations] = useState([]);
  const [history, setHistory] = useState([]);
  // Budget requests state
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  // Staff registrations state
  const [pendingStaff, setPendingStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState('');

  const [activeTab, setActiveTab] = useState('allocations'); // 'allocations' | 'budgets' | 'staff'
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoMissing, setLogoMissing] = useState(false);

  // Remark modal (allocations)
  const [remarkModal, setRemarkModal] = useState(null);
  const [remarkText, setRemarkText] = useState('');
  const [processingId, setProcessingId] = useState(null);
  // Budget review modal
  const [budgetModal, setBudgetModal] = useState(null);
  const [budgetRemarkText, setBudgetRemarkText] = useState('');
  const [budgetProcessingId, setBudgetProcessingId] = useState(null);

  // Pagination
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [budgetPage, setBudgetPage] = useState(1);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('am_portal_user');
      if (!stored) { router.push('/'); return; }
      const parsed = JSON.parse(stored);
      const roles = Array.isArray(parsed?.user_roles) ? parsed.user_roles.map((r) => String(r).toLowerCase()) : [String(parsed?.user_role || '').toLowerCase()];
      if (!roles.includes('account_manager') && !roles.includes('hr')) { router.push('/'); return; }
      setUser(parsed);
    } catch { router.push('/'); }
  }, [router]);

  const fetchPending = async () => {
    setError(''); setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/allocations/pending-account-manager`);
      setAllocations(res.data?.data || []);
    } catch { setError('Unable to load pending allocations.'); setAllocations([]); }
    finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/allocations/history-account-manager`);
      setHistory(res.data?.data || []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const fetchBudgetRequests = async () => {
    try {
      const [pendingRes, histRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/projects/budget-requests/pending-am`).catch(() => null),
        axios.get(`${API_BASE}/api/v1/projects/budget-requests/history`).catch(() => null),
      ]);
      setBudgetRequests(pendingRes?.data?.data || []);
      setBudgetHistory(histRes?.data?.data?.filter((r) => r.status !== 'PENDING') || []);
    } catch { setBudgetRequests([]); }
  };

  const fetchPendingStaff = async (uid) => {
    if (!uid) return;
    setStaffLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/account-manager/pending-staff-registrations?requesterId=${uid}`);
      setPendingStaff(res.data?.data || []);
    } catch { setPendingStaff([]); }
    finally { setStaffLoading(false); }
  };

  useEffect(() => {
    if (user?.user_id) {
      void fetchPending();
      void fetchHistory();
      void fetchBudgetRequests();
      void fetchPendingStaff(user.user_id);
    }
  }, [user?.user_id]);

  const pendingCount = useMemo(() => allocations.length, [allocations]);
  const approvedCount = useMemo(() => history.filter((h) => h.account_manager_status === 'APPROVED').length, [history]);
  const rejectedCount = useMemo(() => history.filter((h) => h.account_manager_status === 'REJECTED').length, [history]);

  const openRemarkModal = (allocationId, action) => {
    setRemarkModal({ allocationId, action });
    setRemarkText('');
  };

  const submitReview = async () => {
    if (!remarkModal || !user?.user_id) return;
    setProcessingId(remarkModal.allocationId);
    try {
      await axios.patch(`${API_BASE}/api/v1/allocations/${remarkModal.allocationId}/account-manager-review`, {
        reviewerId: user.user_id,
        action: remarkModal.action,
        reviewerRemarks: remarkText.trim() || (remarkModal.action === 'APPROVED' ? 'Approved.' : 'Rejected.'),
      });
      setRemarkModal(null);
      await Promise.all([fetchPending(), fetchHistory()]);
    } catch { setError(`Failed to ${remarkModal.action.toLowerCase()} allocation.`); }
    finally { setProcessingId(null); }
  };

  const submitBudgetReview = async () => {
    if (!budgetModal || !user?.user_id) return;
    setBudgetProcessingId(budgetModal.requestId);
    try {
      await axios.patch(`${API_BASE}/api/v1/projects/budget-request/am-review`, {
        requestId: budgetModal.requestId,
        reviewerId: user.user_id,
        action: budgetModal.action,
      });
      setBudgetModal(null);
      await fetchBudgetRequests();
    } catch (e) { setError(e.response?.data?.error || 'Failed to review budget request.'); }
    finally { setBudgetProcessingId(null); }
  };

  const handleStaffApproval = async (userId, action) => {
    if (!user?.user_id) return;
    setStaffFeedback('');
    try {
      await axios.patch(`${API_BASE}/api/v1/account-manager/approve-staff-registration`, {
        requesterId: user.user_id,
        userId,
        action,
      });
      setStaffFeedback(`Staff account ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await fetchPendingStaff(user.user_id);
    } catch (e) { setStaffFeedback(e.response?.data?.error || 'Action failed.'); }
  };

  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0].split('.').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'Account Manager');

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Account Manager Dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-950">Welcome back, {displayName}</h1>
          <p className="mt-2 text-sm text-slate-500">Manage allocations, budget requests, and staff registrations.</p>
        </div>
        <div className="hidden md:block">
          {!logoMissing ? (
            <Image src="/nextan-logo.png" alt="Nextan" width={110} height={34} className="object-contain opacity-80"
              onError={() => setLogoMissing(true)} />
          ) : (
            <span className="text-lg font-bold tracking-tight text-blue-900">nextan</span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Pending Allocations</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{loading ? '—' : allocations.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Budget Requests</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{budgetRequests.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Staff Registrations</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{pendingStaff.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Allocations Approved</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{historyLoading ? '—' : history.filter((h) => h.account_manager_status === 'APPROVED').length}</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs + tables */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex gap-1 border-b border-gray-100 px-4 pt-4">
          <button onClick={() => setActiveTab('allocations')}
            className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'allocations' ? 'bg-[#e8edf8] text-[#1a3a8f]' : 'text-slate-500 hover:text-slate-700'}`}>
            Allocations ({allocations.length})
          </button>
          <button onClick={() => setActiveTab('budgets')}
            className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'budgets' ? 'bg-[#e8edf8] text-[#1a3a8f]' : 'text-slate-500 hover:text-slate-700'}`}>
            Budget Requests ({budgetRequests.length})
          </button>
          <button onClick={() => setActiveTab('staff')}
            className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'staff' ? 'bg-[#e8edf8] text-[#1a3a8f]' : 'text-slate-500 hover:text-slate-700'}`}>
            Staff Registrations ({pendingStaff.length})
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'history' ? 'bg-[#e8edf8] text-[#1a3a8f]' : 'text-slate-500 hover:text-slate-700'}`}>
            Allocation History
          </button>
        </div>

        {activeTab === 'allocations' ? (
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-slate-900">Allocation requests</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1540A8]">Live data</span>
            </div>
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Requested By</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Hours Requested</th>
                  <th className="px-6 py-4">Hours Assigned</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-slate-400">Loading...</td></tr>
                ) : allocations.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No pending allocation requests.</td></tr>
                ) : (() => {
                  const totalPages = Math.max(1, Math.ceil(allocations.length / 10));
                  const safePage = Math.min(pendingPage, totalPages);
                  const page = allocations.slice((safePage - 1) * 10, safePage * 10);
                  return (
                    <>
                      {page.map((item) => (
                        <tr key={item.allocation_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">{item.staff_name || item.staff_email || 'Staff'}</p>
                            <p className="text-xs text-slate-400">{item.staff_email || ''}</p>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700">{item.project_code}</td>
                          <td className="px-6 py-4 text-slate-700">{formatHours(item.hours_requested ?? item.hours_per_week)}</td>
                          <td className="px-6 py-4 text-slate-700">{formatHours(item.hours_per_week)}</td>
                          <td className="px-6 py-4 text-slate-600 max-w-[160px] truncate">{item.reason || item.justification || '—'}</td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('en-SG') : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button type="button" disabled={processingId === item.allocation_id}
                                onClick={() => openRemarkModal(item.allocation_id, 'APPROVED')}
                                className="rounded-xl bg-[#1a3a8f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#12307a] disabled:opacity-60">
                                Approve
                              </button>
                              <button type="button" disabled={processingId === item.allocation_id}
                                onClick={() => openRemarkModal(item.allocation_id, 'REJECTED')}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-100 disabled:opacity-60">
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {totalPages > 1 && (
                        <tr><td colSpan={7} className="px-6 py-3 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Page {safePage} of {totalPages}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setPendingPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                                className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-100">Prev</button>
                              <button onClick={() => setPendingPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-100">Next</button>
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
        ) : activeTab === 'budgets' ? (
          <div className="overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-slate-900">Budget requests awaiting final approval</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Requester</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Hours</th>
                  <th className="px-6 py-4">Justification</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {budgetRequests.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No budget requests pending your approval.</td></tr>
                ) : (() => {
                  const totalPages = Math.max(1, Math.ceil(budgetRequests.length / 10));
                  const safePage = Math.min(budgetPage, totalPages);
                  const page = budgetRequests.slice((safePage - 1) * 10, safePage * 10);
                  return (
                    <>
                      {page.map((item) => (
                        <tr key={item.request_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">{item.requester_name || 'Staff'}</p>
                            <p className="text-xs text-slate-400">{item.requester_email || ''}</p>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700">{item.project_code}</td>
                          <td className="px-6 py-4 text-slate-700">{formatHours(item.requested_hours)} hrs</td>
                          <td className="px-6 py-4 text-slate-600 max-w-[160px] truncate">{item.justification || '—'}</td>
                          <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                          <td className="px-6 py-4 text-xs text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString('en-SG') : '—'}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button type="button" disabled={budgetProcessingId === item.request_id}
                                onClick={() => { setBudgetModal({ requestId: item.request_id, action: 'APPROVED' }); setBudgetRemarkText(''); }}
                                className="rounded-xl bg-[#1a3a8f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#12307a] disabled:opacity-60">Approve</button>
                              <button type="button" disabled={budgetProcessingId === item.request_id}
                                onClick={() => { setBudgetModal({ requestId: item.request_id, action: 'REJECTED' }); setBudgetRemarkText(''); }}
                                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-100 disabled:opacity-60">Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {totalPages > 1 && (
                        <tr><td colSpan={7} className="px-6 py-3 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Page {safePage} of {totalPages}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setBudgetPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                                className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-100">Prev</button>
                              <button onClick={() => setBudgetPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-100">Next</button>
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
        ) : activeTab === 'staff' ? (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Pending Staff Registrations</h2>
              {staffFeedback && (
                <span className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${staffFeedback.includes('approved') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{staffFeedback}</span>
              )}
            </div>
            {staffLoading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : pendingStaff.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No pending staff registrations.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Requested</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingStaff.map((u) => (
                    <tr key={u.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="px-6 py-4 text-slate-600">{u.email}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleStaffApproval(u.user_id, 'approve')}
                            className="rounded-xl bg-[#1a3a8f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#12307a]">Approve</button>
                          <button onClick={() => handleStaffApproval(u.user_id, 'reject')}
                            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-100">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-bold text-slate-900">Reviewed allocations</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Staff</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Hours / Week</th>
                  <th className="px-6 py-4">Manager</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyLoading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-slate-400">Loading...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No history yet.</td></tr>
                ) : (() => {
                  const totalPages = Math.max(1, Math.ceil(history.length / 10));
                  const safePage = Math.min(historyPage, totalPages);
                  const page = history.slice((safePage - 1) * 10, safePage * 10);
                  return (
                    <>
                      {page.map((item) => (
                        <tr key={item.allocation_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">{item.staff_name || item.staff_email || 'Staff'}</p>
                            <p className="text-xs text-slate-400">{item.staff_email || ''}</p>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700">{item.project_code}</td>
                          <td className="px-6 py-4 text-slate-700">{formatHours(item.hours_per_week)}</td>
                          <td className="px-6 py-4 text-slate-700">{item.manager_name || item.manager_email || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.account_manager_status === 'APPROVED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                            }`}>{item.account_manager_status === 'APPROVED' ? 'Approved' : 'Rejected'}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {item.account_manager_reviewed_at ? new Date(item.account_manager_reviewed_at).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                        </tr>
                      ))}
                      {totalPages > 1 && (
                        <tr><td colSpan={6} className="px-6 py-3 bg-slate-50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Page {safePage} of {totalPages}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                                className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-100">Prev</button>
                              <button onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-gray-100">Next</button>
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
        )}
      </div>

      {/* Remark modal */}
      {remarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {remarkModal.action === 'APPROVED' ? 'Approve Allocation' : 'Reject Allocation'}
            </h2>
            <p className="text-sm text-slate-500 mb-5">Add an optional remark. Staff will be notified.</p>
            <textarea
              rows={3}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="Remark (optional)…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRemarkModal(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button onClick={submitReview} disabled={!!processingId}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${remarkModal.action === 'APPROVED' ? 'bg-[#1a3a8f] hover:bg-[#12307a]' : 'bg-red-600 hover:bg-red-700'}`}>
                {processingId ? 'Processing…' : remarkModal.action === 'APPROVED' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget review modal */}
      {budgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {budgetModal.action === 'APPROVED' ? 'Approve Budget Request' : 'Reject Budget Request'}
            </h2>
            <p className="text-sm text-slate-500 mb-5">Confirm your decision. Staff will be notified.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBudgetModal(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={submitBudgetReview} disabled={!!budgetProcessingId}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${budgetModal.action === 'APPROVED' ? 'bg-[#1a3a8f] hover:bg-[#12307a]' : 'bg-red-600 hover:bg-red-700'}`}>
                {budgetProcessingId ? 'Processing…' : budgetModal.action === 'APPROVED' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
