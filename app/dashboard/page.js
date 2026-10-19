"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useT, getLocale } from '../i18n/LanguageProvider';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

function formatHours(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function StatusPill({ status }) {
  const { t } = useT();
  const map = {
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    MANAGER_APPROVED: 'bg-[#E8EEFF] text-[#1a3a8f]',
  };
  const label = String(status || '').replace('_', ' ');
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{t(label)}</span>;
}

function EventBadge({ type }) {
  const { t } = useT();
  const map = {
    ALLOCATION: 'bg-[#E8EEFF] text-[#1a3a8f]',
    BUDGET: 'bg-pink-100 text-pink-800',
    STAFF: 'bg-emerald-100 text-emerald-700',
  };
  const label = { ALLOCATION: 'Allocation', BUDGET: 'Budget Request', STAFF: 'Staff Registration' }[type] || type;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[type] || 'bg-slate-100 text-slate-600'}`}>{t(label)}</span>;
}

// Card surface used across the redesigned dashboards: white, no border, a soft navy-tinted shadow.
const CARD = 'rounded-3xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(22,48,122,0.18)]';
const TABLE_HEAD = 'border-b border-slate-200 bg-slate-50 text-left text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500';

function StatIcon({ name }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'budget') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'staff') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;
  return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 15h3" /></svg>;
}

export default function AccountManagerDashboard() {
  const { t } = useT();
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
  const [staffHistory, setStaffHistory] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState('');

  const [activeTab, setActiveTab] = useState('allocations'); // 'allocations' | 'budgets' | 'staff' | 'history'
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  // Which stat card the user clicked; only that card gets the outline (none on first load).
  const [selectedCard, setSelectedCard] = useState(null);

  // Remark modal (allocations)
  const [remarkModal, setRemarkModal] = useState(null);
  const [remarkText, setRemarkText] = useState('');
  const [remarkError, setRemarkError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  // Budget review modal
  const [budgetModal, setBudgetModal] = useState(null);
  const [budgetProcessingId, setBudgetProcessingId] = useState(null);

  // Pagination
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [budgetPage, setBudgetPage] = useState(1);

  // History filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL'); // ALL | ALLOCATION | BUDGET | STAFF
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historySearch, setHistorySearch] = useState('');

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
    } catch { setError(t("Unable to load pending allocations.")); setAllocations([]); }
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
        axios.get(`${API_BASE}/api/v1/projects/budget-requests/pending-am?reviewerId=${user?.user_id || ''}`).catch(() => null),
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
      const [pendingRes, histRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/account-manager/pending-staff-registrations?requesterId=${uid}`).catch(() => null),
        axios.get(`${API_BASE}/api/v1/account-manager/staff-registration-history?requesterId=${uid}`).catch(() => null),
      ]);
      setPendingStaff(pendingRes?.data?.data || []);
      setStaffHistory(histRes?.data?.data || []);
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

  const openRemarkModal = (allocationId, action) => {
    setRemarkModal({ allocationId, action });
    setRemarkText('');
    setRemarkError('');
  };

  const submitReview = async () => {
    if (!remarkModal || !user?.user_id) return;
    // Same rule as the Approvals page: rejecting needs a reason, approving doesn't.
    if (remarkModal.action === 'REJECTED' && !remarkText.trim()) {
      setRemarkError('Please provide a reason for rejecting this request.');
      return;
    }
    setRemarkError('');
    setProcessingId(remarkModal.allocationId);
    try {
      await axios.patch(`${API_BASE}/api/v1/allocations/${remarkModal.allocationId}/account-manager-review`, {
        reviewerId: user.user_id,
        action: remarkModal.action,
        reviewerRemarks: remarkText.trim() || (remarkModal.action === 'APPROVED' ? 'Approved.' : 'Rejected.'),
      });
      setRemarkModal(null);
      await Promise.all([fetchPending(), fetchHistory()]);
    } catch (err) { setError(t(err.response?.data?.error || `Failed to ${remarkModal.action.toLowerCase()} allocation.`)); }
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
    } catch (e) { setError(t(e.response?.data?.error || 'Failed to review budget request.')); }
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

  // ─── Unified History rows across allocations / budget / staff registrations ───
  const combinedHistory = useMemo(() => {
    const allocRows = history.map((item) => ({
      type: 'ALLOCATION',
      key: `alloc-${item.allocation_id}`,
      description: t("Allocation of {v} hrs/week requested", { v: formatHours(item.hours_per_week) }),
      target: item.project_code,
      actor: item.manager_name || item.manager_email || item.staff_name || '—',
      status: item.account_manager_status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      date: item.account_manager_reviewed_at || item.created_at,
    }));
    const budgetRows = budgetHistory.map((item) => ({
      type: 'BUDGET',
      key: `budget-${item.request_id}`,
      description: t("Budget requested: {v} hrs for {v2}", { v: formatHours(item.requested_hours), v2: item.project_name || item.project_code }),
      target: item.project_code,
      actor: item.requester_name || item.requester_email || '—',
      status: item.status === 'APPROVED' ? 'APPROVED' : item.status === 'REJECTED' ? 'REJECTED' : item.status,
      date: item.reviewed_at || item.created_at,
    }));
    const staffRows = staffHistory.map((item) => ({
      type: 'STAFF',
      key: `staff-${item.user_id}`,
      description: t("Staff registered: {full_name}", { full_name: item.full_name }),
      target: '—',
      actor: item.full_name,
      status: item.account_status === 'active' ? 'APPROVED' : 'REJECTED',
      date: item.created_at,
    }));
    return [...allocRows, ...budgetRows, ...staffRows].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [history, budgetHistory, staffHistory]);

  const filteredHistory = combinedHistory.filter((row) => {
    if (historyTypeFilter !== 'ALL' && row.type !== historyTypeFilter) return false;
    if (historyDateFrom && new Date(row.date) < new Date(historyDateFrom)) return false;
    if (historyDateTo) {
      const end = new Date(historyDateTo); end.setHours(23, 59, 59, 999);
      if (new Date(row.date) > end) return false;
    }
    const q = historySearch.trim().toLowerCase();
    if (q && !String(row.actor || '').toLowerCase().includes(q) && !String(row.target || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const goToTab = (tab) => {
    setActiveTab(tab);
    document.getElementById('am-approvals-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stats = [
    { key: 'allocations', label: t("Allocations to review"), value: loading ? '—' : allocations.length, icon: 'allocations', tint: 'bg-[#E8EEFF] text-[#16307a]' },
    { key: 'budgets', label: t("Budget to review"), value: budgetRequests.length, icon: 'budget', tint: 'bg-pink-100 text-pink-800' },
    { key: 'staff', label: t("Staff registrations"), value: pendingStaff.length, icon: 'staff', tint: 'bg-yellow-100 text-yellow-700' },
  ];

  const totalPending = allocations.length + budgetRequests.length + pendingStaff.length;
  const firstName = displayName.split(' ')[0];

  // Worked out only once the user is loaded (always client-side), so the server render and the
  // first client render match and the time-based text can't cause a hydration mismatch.
  const greeting = (() => {
    if (!user) return 'Welcome back';
    const hour = Number(new Date().toLocaleString(getLocale(), { timeZone: 'Asia/Singapore', hour: 'numeric', hour12: false }));
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  })();
  const todayLabel = user
    ? new Date().toLocaleDateString(getLocale(), { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  const openCard = (key) => {
    setSelectedCard(key);
    goToTab(key);
  };

  return (
    <div className="px-6 pb-8 pt-2 sm:px-8">
      {/* Greeting */}
      <section className="relative mb-8 overflow-hidden rounded-3xl px-8 py-9 text-white sm:px-10" style={{ background: '#16307a' }}>
        <svg className="pointer-events-none absolute -right-8 -top-12 hidden sm:block" width="320" height="320" viewBox="0 0 320 320" fill="none" aria-hidden="true">
          <circle cx="160" cy="160" r="130" stroke="#2f56b8" strokeWidth="2" />
          <circle cx="160" cy="160" r="96" stroke="#2f56b8" strokeWidth="2" strokeDasharray="4 8" />
          <circle cx="160" cy="160" r="62" fill="#1a3a8f" stroke="#E8EEFF" strokeWidth="3" />
          <path d="M134 162l18 18 36-38" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="268" cy="80" r="13" fill="#f0c9dc" />
          <circle cx="52" cy="226" r="8" fill="#E8EEFF" />
        </svg>
        <div className="relative max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#aab8e0]">{todayLabel || 'Account Manager Dashboard'}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t(greeting)}, {firstName}</h1>
          <p className="mt-3 text-sm text-[#d6def5]">
            {loading ? t("Checking for requests…")
              : totalPending === 0 ? t("You’re all caught up. Nothing is waiting for your approval.")
                : (totalPending === 1 ? t("1 item is waiting for your approval.") : t("{totalPending} items are waiting for your approval.", { totalPending: totalPending }))}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button"
              onClick={() => goToTab(allocations.length > 0 ? 'allocations' : budgetRequests.length > 0 ? 'budgets' : pendingStaff.length > 0 ? 'staff' : 'allocations')}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#16307a] transition hover:bg-[#E8EEFF]">{t("Review requests")}</button>
            <Link href="/my-projects"
              className="rounded-2xl border border-[#4a6bc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">{t("Issue project code")}</Link>
          </div>
        </div>
      </section>

      {/* Stat cards: each one opens its list in the panel below */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((item) => (
          <button key={item.label} type="button" onClick={() => openCard(item.key)} aria-pressed={selectedCard === item.key}
            className={`${CARD} flex items-center gap-4 px-5 py-5 text-left transition hover:shadow-md ${selectedCard === item.key ? 'ring-2 ring-[#1540A8]' : ''}`}>
            <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${item.tint}`}>
              <StatIcon name={item.icon} />
            </span>
            <span className="flex flex-col">
              <span className="text-2xl font-extrabold leading-tight text-slate-900 tabular-nums">{item.value}</span>
              <span className="text-xs text-slate-500">{t(item.label)}</span>
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Approvals panel */}
      <section id="am-approvals-panel" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-slate-900">{activeTab === 'history' ? t("Recent decisions") : t("Waiting for you")}</h2>
          <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
            {[
              { id: 'allocations', label: t("Allocations · {length}", { length: allocations.length }) },
              { id: 'budgets', label: t("Budget · {length}", { length: budgetRequests.length }) },
              { id: 'staff', label: t("Staff · {length}", { length: pendingStaff.length }) },
              { id: 'history', label: t("History") },
            ].map((tabItem) => (
              <button key={tabItem.id} type="button" onClick={() => { setActiveTab(tabItem.id); setSelectedCard(tabItem.id === 'history' ? null : tabItem.id); }}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${activeTab === tabItem.id ? 'bg-[#1540A8] text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                {t(tabItem.label)}
              </button>
            ))}
          </div>
        </div>

      <div className={`${CARD} overflow-hidden`}>
        {activeTab === 'allocations' ? (
          <div>
            {loading ? (
              <p className="px-6 py-8 text-slate-400">{t("Loading...")}</p>
            ) : allocations.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-400">{t("No pending allocation requests.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="px-6 py-4">{t("Requested By")}</th>
                      <th className="px-6 py-4">{t("Project")}</th>
                      <th className="px-6 py-4">{t("Hours Requested")}</th>
                      <th className="px-6 py-4">{t("Hours Assigned")}</th>
                      <th className="px-6 py-4">{t("Reason")}</th>
                      <th className="px-6 py-4">{t("Submitted")}</th>
                      <th className="px-6 py-4">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(allocations.length / 10));
                      const safePage = Math.min(pendingPage, totalPages);
                      const page = allocations.slice((safePage - 1) * 10, safePage * 10);
                      return (
                        <>
                          {page.map((item) => (
                            <tr key={item.allocation_id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-slate-900">{item.staff_name || item.staff_email || 'Staff'}</p>
                                <p className="text-xs text-slate-400">{item.staff_email || ''}</p>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-700">{item.project_code}</td>
                              <td className="px-6 py-4 text-slate-700">{formatHours(item.hours_requested ?? item.hours_per_week)}</td>
                              <td className="px-6 py-4 text-slate-700">{formatHours(item.hours_per_week)}</td>
                              <td className="px-6 py-4 text-slate-600 max-w-[160px] truncate">{item.reason || item.justification || '—'}</td>
                              <td className="px-6 py-4 text-xs text-slate-400">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString(getLocale(), { timeZone: 'Asia/Singapore' }) : '—'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button type="button" disabled={processingId === item.allocation_id}
                                    onClick={() => openRemarkModal(item.allocation_id, 'APPROVED')}
                                    className="rounded-xl bg-[#1540A8] px-4 py-2 text-xs font-bold text-white hover:bg-[#12378F] disabled:opacity-60">{t("Approve")}</button>
                                  <button type="button" disabled={processingId === item.allocation_id}
                                    onClick={() => openRemarkModal(item.allocation_id, 'REJECTED')}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60">{t("Reject")}</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {totalPages > 1 && (
                            <tr><td colSpan={7} className="px-6 py-3 bg-slate-50">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">{t("Page {safePage} of {totalPages}", { safePage: safePage, totalPages: totalPages })}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => setPendingPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">{t("Prev")}</button>
                                  <button onClick={() => setPendingPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">{t("Next")}</button>
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
        ) : activeTab === 'budgets' ? (
          <div>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t("Budget requests awaiting final approval")}</h2>
            </div>
            {budgetRequests.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-400">{t("No budget requests pending your approval.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="px-6 py-4">{t("Requester")}</th>
                      <th className="px-6 py-4">{t("Project")}</th>
                      <th className="px-6 py-4">{t("Hours")}</th>
                      <th className="px-6 py-4">{t("Justification")}</th>
                      <th className="px-6 py-4">{t("Status")}</th>
                      <th className="px-6 py-4">{t("Submitted")}</th>
                      <th className="px-6 py-4">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(budgetRequests.length / 10));
                      const safePage = Math.min(budgetPage, totalPages);
                      const page = budgetRequests.slice((safePage - 1) * 10, safePage * 10);
                      return (
                        <>
                          {page.map((item) => (
                            <tr key={item.request_id} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <p className="font-semibold text-slate-900">{item.requester_name || 'Staff'}</p>
                                <p className="text-xs text-slate-400">{item.requester_email || ''}</p>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-700">{item.project_code}</td>
                              <td className="px-6 py-4 text-slate-700">{t("{formatHours} hrs", { formatHours: formatHours(item.requested_hours) })}</td>
                              <td className="px-6 py-4 text-slate-600 max-w-[160px] truncate">{item.justification || '—'}</td>
                              <td className="px-6 py-4"><StatusPill status={item.status} /></td>
                              <td className="px-6 py-4 text-xs text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString(getLocale(), { timeZone: 'Asia/Singapore' }) : '—'}</td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button type="button" disabled={budgetProcessingId === item.request_id}
                                    onClick={() => setBudgetModal({ requestId: item.request_id, action: 'APPROVED' })}
                                    className="rounded-xl bg-[#1540A8] px-4 py-2 text-xs font-bold text-white hover:bg-[#12378F] disabled:opacity-60">{t("Approve")}</button>
                                  <button type="button" disabled={budgetProcessingId === item.request_id}
                                    onClick={() => setBudgetModal({ requestId: item.request_id, action: 'REJECTED' })}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60">{t("Reject")}</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {totalPages > 1 && (
                            <tr><td colSpan={7} className="px-6 py-3 bg-slate-50">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">{t("Page {safePage} of {totalPages}", { safePage: safePage, totalPages: totalPages })}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => setBudgetPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">{t("Prev")}</button>
                                  <button onClick={() => setBudgetPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">{t("Next")}</button>
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
        ) : activeTab === 'staff' ? (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">{t("Pending Staff Registrations")}</h2>
              {staffFeedback && (
                <span className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${staffFeedback.includes('approved') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{staffFeedback}</span>
              )}
            </div>
            {staffLoading ? (
              <p className="text-sm text-slate-400">{t("Loading...")}</p>
            ) : pendingStaff.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">{t("No pending staff registrations.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="px-6 py-4">{t("Name")}</th>
                      <th className="px-6 py-4">{t("Email")}</th>
                      <th className="px-6 py-4">{t("Requested")}</th>
                      <th className="px-6 py-4">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingStaff.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{u.full_name}</td>
                        <td className="px-6 py-4 text-slate-600">{u.email}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Singapore' }) : '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleStaffApproval(u.user_id, 'approve')}
                              className="rounded-xl bg-[#1540A8] px-4 py-2 text-xs font-bold text-white hover:bg-[#12378F]">{t("Approve")}</button>
                            <button onClick={() => handleStaffApproval(u.user_id, 'reject')}
                              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600">{t("Reject")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex gap-1.5">
                {[
                  { id: 'ALL', label: t("All") },
                  { id: 'ALLOCATION', label: t("Allocations") },
                  { id: 'BUDGET', label: t("Budget Requests") },
                  { id: 'STAFF', label: t("Staff Registrations") },
                ].map((f) => (
                  <button key={f.id} type="button"
                    onClick={() => { setHistoryTypeFilter(f.id); setHistoryPage(1); }}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      historyTypeFilter === f.id ? 'bg-[#1540A8] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {t(f.label)}
                  </button>
                ))}
              </div>
              <input type="date" value={historyDateFrom} onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-slate-400">{t("to")}</span>
              <input type="date" value={historyDateTo} onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="relative ml-auto">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" value={historySearch} onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                  placeholder={t("Search staff, manager, or project…")}
                  className="rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-1.5 text-sm text-slate-900 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {historyLoading ? (
              <p className="px-6 py-8 text-slate-400">{t("Loading...")}</p>
            ) : filteredHistory.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-400">{t("No history records match this filter.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="px-6 py-4">{t("Event / Type")}</th>
                      <th className="px-6 py-4">{t("Description")}</th>
                      <th className="px-6 py-4">{t("Target / Project")}</th>
                      <th className="px-6 py-4">{t("Actor")}</th>
                      <th className="px-6 py-4">{t("Status")}</th>
                      <th className="px-6 py-4">{t("Date & Time")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(filteredHistory.length / 10));
                      const safePage = Math.min(historyPage, totalPages);
                      const page = filteredHistory.slice((safePage - 1) * 10, safePage * 10);
                      return (
                        <>
                          {page.map((row) => (
                            <tr key={row.key} className="hover:bg-slate-50">
                              <td className="px-6 py-4"><EventBadge type={row.type} /></td>
                              <td className="px-6 py-4 text-slate-700 max-w-[260px] truncate">{t(row.description)}</td>
                              <td className="px-6 py-4 font-medium text-slate-700">{row.target}</td>
                              <td className="px-6 py-4 text-slate-700">{row.actor}</td>
                              <td className="px-6 py-4"><StatusPill status={row.status} /></td>
                              <td className="px-6 py-4 text-xs text-slate-400">
                                {row.date ? new Date(row.date).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Singapore' }) : '—'}
                              </td>
                            </tr>
                          ))}
                          {totalPages > 1 && (
                            <tr><td colSpan={6} className="px-6 py-3 bg-slate-50">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">{t("Page {safePage} of {totalPages}", { safePage: safePage, totalPages: totalPages })}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">{t("Prev")}</button>
                                  <button onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-100">{t("Next")}</button>
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
        )}
      </div>
      </section>

      {/* Remark modal */}
      {remarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {remarkModal.action === 'APPROVED' ? t("Approve Allocation") : t("Reject Allocation")}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              {remarkModal.action === 'REJECTED' ? t("Give a reason for rejecting. Staff will be notified.") : t("Add an optional remark. Staff will be notified.")}
            </p>
            <textarea
              rows={3}
              value={remarkText}
              onChange={(e) => { setRemarkText(e.target.value); if (remarkError) setRemarkError(''); }}
              placeholder={remarkModal.action === 'REJECTED' ? t("Reason for rejecting (required)…") : t("Remark (optional)…")}
              className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${remarkError ? 'border-red-400 mb-2' : 'border-slate-200 mb-5'}`}
            />
            {remarkError && <p className="mb-5 text-sm font-medium text-red-500">{remarkError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRemarkModal(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">{t("Cancel")}</button>
              <button onClick={submitReview} disabled={!!processingId}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${remarkModal.action === 'APPROVED' ? 'bg-[#1540A8] hover:bg-[#12378F]' : 'bg-red-600 hover:bg-red-700'}`}>
                {processingId ? t("Processing…") : remarkModal.action === 'APPROVED' ? t("Confirm Approve") : t("Confirm Reject")}
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
              {budgetModal.action === 'APPROVED' ? t("Approve Budget Request") : t("Reject Budget Request")}
            </h2>
            <p className="text-sm text-slate-500 mb-5">{t("Confirm your decision. Staff will be notified.")}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBudgetModal(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">{t("Cancel")}</button>
              <button onClick={submitBudgetReview} disabled={!!budgetProcessingId}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${budgetModal.action === 'APPROVED' ? 'bg-[#1540A8] hover:bg-[#12378F]' : 'bg-red-600 hover:bg-red-700'}`}>
                {budgetProcessingId ? t("Processing…") : budgetModal.action === 'APPROVED' ? t("Confirm Approve") : t("Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
