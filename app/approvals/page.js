"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useConfirm } from '../ConfirmDialog';
import { useT, getLocale } from '../i18n/LanguageProvider';

function formatDateOnly(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
}

function formatHours(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function statusBadge(status) {
  const s = String(status || '').toUpperCase();
  const colors = {
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    PENDING:  'bg-yellow-100 text-yellow-700',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[s] || 'bg-slate-100 text-slate-600'}`}>{s}</span>;
}

function EventBadge({ type }) {
  const { t } = useT();
  const map = {
    ALLOCATION: 'bg-blue-50 text-blue-700',
    BUDGET: 'bg-purple-50 text-purple-700',
    STAFF: 'bg-emerald-50 text-emerald-700',
  };
  const label = { ALLOCATION: 'Allocation', BUDGET: 'Budget Request', STAFF: 'Staff Registration' }[type] || type;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[type] || 'bg-gray-100 text-gray-600'}`}>{t(label)}</span>;
}

const TAB_IDS = ['ALLOCATION', 'BUDGET', 'STAFF', 'HISTORY'];

function ApprovalsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('ALLOCATION'); // ALLOCATION | BUDGET | STAFF | HISTORY
  // ?tab=ALLOCATION|BUDGET|STAFF|HISTORY opens that tab (used by the top bar's notifications).
  // Watched, not just read once, so it also switches tab while already on this page.
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (TAB_IDS.includes(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);
  const [managerId, setManagerId] = useState('');

  const [allocations, setAllocations] = useState([]);
  const [allocationHistory, setAllocationHistory] = useState([]);
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [pendingStaff, setPendingStaff] = useState([]);
  const [staffHistory, setStaffHistory] = useState([]);

  const [reviewModal, setReviewModal] = useState(null); // { type, item, action, isStaff }
  const [reviewRemark, setReviewRemark] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [confirm, confirmDialog] = useConfirm();
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // History filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('am_portal_user') || '{}');
      if (u?.user_id) setManagerId(u.user_id);
    } catch {}
  }, []);

  const loadAllocations = useCallback(async () => {
    try {
      const [pendingRes, histRes] = await Promise.all([
        axios.get(`${backendBaseUrl}/api/v1/allocations/pending-account-manager`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/allocations/history-account-manager`).catch(() => ({ data: { data: [] } })),
      ]);
      setAllocations(pendingRes.data.data || []);
      setAllocationHistory(histRes.data.data || []);
    } catch { setAllocations([]); }
  }, [backendBaseUrl]);

  const loadBudgets = useCallback(async () => {
    try {
      const [pendingRes, histRes] = await Promise.all([
        axios.get(`${backendBaseUrl}/api/v1/projects/budget-requests/pending-am?reviewerId=${managerId}`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/projects/budget-requests/history`).catch(() => ({ data: { data: [] } })),
      ]);
      setBudgetRequests(pendingRes.data.data || []);
      setBudgetHistory((histRes.data.data || []).filter((r) => r.status !== 'PENDING'));
    } catch { setBudgetRequests([]); }
  }, [backendBaseUrl, managerId]);

  const loadStaff = useCallback(async () => {
    if (!managerId) return;
    try {
      const [pendingRes, histRes] = await Promise.all([
        axios.get(`${backendBaseUrl}/api/v1/account-manager/pending-staff-registrations?requesterId=${managerId}`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/account-manager/staff-registration-history?requesterId=${managerId}`).catch(() => ({ data: { data: [] } })),
      ]);
      setPendingStaff(pendingRes.data.data || []);
      setStaffHistory(histRes.data.data || []);
    } catch { setPendingStaff([]); }
  }, [backendBaseUrl, managerId]);

  useEffect(() => {
    if (!managerId) return;
    loadAllocations();
    loadBudgets();
    loadStaff();
  }, [managerId, loadAllocations, loadBudgets, loadStaff]);

  useEffect(() => { setSelectedIds([]); }, [activeTab]);

  const showToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  };

  const openReviewModal = (type, item, action) => {
    setReviewModal({ type, item, action });
    setReviewRemark('');
    setReviewError('');
    setFeedback('');
  };

  const runAllocationReview = async (allocationId, action, remarks) => {
    await axios.patch(`${backendBaseUrl}/api/v1/allocations/${allocationId}/account-manager-review`, {
      reviewerId: managerId, action, reviewerRemarks: remarks || (action === 'APPROVED' ? 'Approved.' : 'Rejected.'),
    });
  };

  const runBudgetReview = async (requestId, action) => {
    await axios.patch(`${backendBaseUrl}/api/v1/projects/budget-request/am-review`, {
      requestId, reviewerId: managerId, action,
    });
  };

  const runStaffReview = async (userId, action) => {
    await axios.patch(`${backendBaseUrl}/api/v1/account-manager/approve-staff-registration`, {
      requesterId: managerId, userId, action: action === 'APPROVED' ? 'approve' : 'reject',
    });
  };

  const submitModalReview = async () => {
    if (!reviewModal) return;
    if (reviewModal.action === 'REJECTED' && !reviewRemark.trim() && reviewModal.type !== 'STAFF') {
      setReviewError('Please provide a reason for rejecting this request.');
      return;
    }
    setSubmitting(true); setFeedback(''); setReviewError('');
    try {
      const { type, item, action } = reviewModal;
      if (type === 'ALLOCATION') await runAllocationReview(item.allocation_id, action, reviewRemark.trim());
      else if (type === 'BUDGET') await runBudgetReview(item.request_id, action);
      else await runStaffReview(item.user_id, action);

      setFeedback('Done! Notified where applicable.');
      setTimeout(() => {
        setReviewModal(null);
        if (type === 'ALLOCATION') loadAllocations();
        else if (type === 'BUDGET') loadBudgets();
        else loadStaff();
        showToast(`${action === 'APPROVED' ? 'Approved' : 'Rejected'} ${type === 'ALLOCATION' ? 'allocation' : type === 'BUDGET' ? 'budget request' : 'staff registration'}.`);
      }, 700);
    } catch (err) {
      setFeedback(err.response?.data?.error || 'Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentList = activeTab === 'ALLOCATION' ? allocations : activeTab === 'BUDGET' ? budgetRequests : activeTab === 'STAFF' ? pendingStaff : [];
  const currentIdOf = (item) => activeTab === 'ALLOCATION' ? item.allocation_id : activeTab === 'BUDGET' ? item.request_id : item.user_id;
  const allSelected = currentList.length > 0 && selectedIds.length === currentList.length;

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm({
      title: t("Bulk approve"),
      message: t("Approve {length} selected item(s)?", { length: selectedIds.length }),
      confirmLabel: 'Approve',
    });
    if (!confirmed) return;
    setBulkSubmitting(true);
    try {
      for (const id of selectedIds) {
        if (activeTab === 'ALLOCATION') await runAllocationReview(id, 'APPROVED');
        else if (activeTab === 'BUDGET') await runBudgetReview(id, 'APPROVED');
        else await runStaffReview(id, 'APPROVED');
      }
      showToast(t("Approved {length} item(s).", { length: selectedIds.length }));
      setSelectedIds([]);
      if (activeTab === 'ALLOCATION') loadAllocations();
      else if (activeTab === 'BUDGET') loadBudgets();
      else loadStaff();
    } catch {
      setFeedback('Bulk approval failed partway through — please review remaining items.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ─── Unified History ───
  const combinedHistory = useMemo(() => {
    const allocRows = allocationHistory.map((item) => ({
      type: 'ALLOCATION',
      key: `alloc-${item.allocation_id}`,
      description: t("Allocation of {v} hrs/week for {project_code}", { v: formatHours(item.hours_per_week), project_code: item.project_code }),
      target: item.project_code,
      actor: item.staff_name || item.staff_email || '—',
      status: item.account_manager_status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      date: item.account_manager_reviewed_at || item.created_at,
    }));
    const budgetRows = budgetHistory.map((item) => ({
      type: 'BUDGET',
      key: `budget-${item.request_id}`,
      description: t("Budget requested: {v} hrs for {v2}", { v: formatHours(item.requested_hours), v2: item.project_name || item.project_code }),
      target: item.project_code,
      actor: item.requester_name || item.requester_email || '—',
      status: item.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
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
  }, [allocationHistory, budgetHistory, staffHistory]);

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">{t("Approvals")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("Review outstanding allocations, budget requests, and staff registrations.")}</p>
        </div>
      </div>

      {/* Stat cards — click to jump to the matching tab below */}
      <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { key: 'ALLOCATION', label: t("Pending Allocations"), value: allocations.length },
          { key: 'BUDGET', label: t("Budget Requests"), value: budgetRequests.length },
          { key: 'STAFF', label: t("Staff Registrations"), value: pendingStaff.length },
        ].map((s) => (
          <button key={s.key} type="button" onClick={() => setActiveTab(s.key)}
            className={`text-left rounded-2xl border bg-white px-6 py-5 shadow-sm transition ${
              activeTab === s.key ? 'border-[#1a3a8f] ring-2 ring-[#1a3a8f]/30' : 'border-gray-100 hover:border-slate-300'
            }`}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t(s.label)}</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 px-4 pt-4">
          {[
            { id: 'ALLOCATION', label: t("Allocations ({length})", { length: allocations.length }) },
            { id: 'BUDGET', label: t("Budget Requests ({length})", { length: budgetRequests.length }) },
            { id: 'STAFF', label: t("Staff Registrations ({length})", { length: pendingStaff.length }) },
            { id: 'HISTORY', label: t("History") },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tabItem.id ? 'bg-[#e8edf8] text-[#1a3a8f]' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab(tabItem.id)}
            >
              {t(tabItem.label)}
            </button>
          ))}
        </div>

      {/* ─── PENDING (Allocations / Budget / Staff) ─── */}
      {activeTab !== 'HISTORY' && (
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-end gap-4 mb-5">
            {currentList.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={allSelected}
                    onChange={(e) => setSelectedIds(e.target.checked ? currentList.map(currentIdOf) : [])}
                    className="rounded border-slate-300" />{t("Select All")}</label>
                <button type="button" onClick={handleBulkApprove} disabled={selectedIds.length === 0 || bulkSubmitting}
                  className="rounded-2xl bg-[#1540A8] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-[#12378F]">
                  {bulkSubmitting ? t("Approving…") : t("Bulk Approve{v}", { v: selectedIds.length > 0 ? ` (${selectedIds.length})` : '' })}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {currentList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">{t("No pending")}{" "}{activeTab === 'ALLOCATION' ? t("allocation") : activeTab === 'BUDGET' ? t("budget") : t("staff registration")}{" "}{t("requests.")}</div>
            ) : currentList.map((item) => {
              const id = currentIdOf(item);
              return (
                <div key={id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.includes(id)}
                        onChange={() => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                        className="mt-1.5 rounded border-slate-300" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {activeTab === 'ALLOCATION' ? t("Allocation Request") : activeTab === 'BUDGET' ? t("Budget Request") : t("Staff Registration")}
                        </p>
                        {activeTab === 'ALLOCATION' && (
                          <>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.staff_name || item.staff_email || 'Staff'}</h3>
                            <p className="mt-1 text-sm text-slate-500">{t("{project_code} • {formatHours} hrs requested", { project_code: item.project_code, formatHours: formatHours(item.hours_requested ?? item.hours_per_week) })}{" "}{item.hours_per_week != null && <span className="ml-1">{t("({formatHours} hrs assigned)", { formatHours: formatHours(item.hours_per_week) })}</span>}
                            </p>
                            {(item.reason || item.justification) && <p className="mt-1 text-xs text-slate-400">{t("Reason:")}{" "}{item.reason || item.justification}</p>}
                          </>
                        )}
                        {activeTab === 'BUDGET' && (
                          <>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.project_name || item.project_code}</h3>
                            <p className="mt-1 text-sm text-slate-500">{t("{project_code} • {formatHours} hrs requested", { project_code: item.project_code, formatHours: formatHours(item.requested_hours) })}</p>
                            {item.requester_name && <p className="mt-1 text-xs text-slate-400">{t("Requested by: {requester_name}", { requester_name: item.requester_name })}</p>}
                          </>
                        )}
                        {activeTab === 'STAFF' && (
                          <>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.full_name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{item.email}</p>
                          </>
                        )}
                        <p className="mt-1 text-xs text-slate-400">{t("Submitted")}{" "}{item.created_at ? new Date(item.created_at).toLocaleDateString(getLocale(), { timeZone: 'Asia/Singapore' }) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => openReviewModal(activeTab, item, 'APPROVED')}
                        className="rounded-2xl bg-[#1540A8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#12378F]"
                      >{t("Approve")}</button>
                      <button
                        onClick={() => openReviewModal(activeTab, item, 'REJECTED')}
                        className="rounded-2xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-400 hover:text-red-600"
                      >{t("Reject")}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 'HISTORY' && (
        <div className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-slate-100">
            <div className="flex gap-1.5">
              {[
                { id: 'ALL', label: t("All") },
                { id: 'ALLOCATION', label: t("Allocations") },
                { id: 'BUDGET', label: t("Budget") },
                { id: 'STAFF', label: t("Staff") },
              ].map((c) => (
                <button key={c.id} type="button" onClick={() => setHistoryTypeFilter(c.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    historyTypeFilter === c.id ? 'bg-[#1540A8] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {t(c.label)}
                </button>
              ))}
            </div>
            <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-xs text-slate-400">{t("to")}</span>
            <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="relative ml-auto">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={t("Search staff or project…")}
                className="rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-1.5 text-sm text-slate-900 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">{t("No reviewed records match this filter.")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">{t("Event / Type")}</th>
                    <th className="px-6 py-4">{t("Description")}</th>
                    <th className="px-6 py-4">{t("Target / Project")}</th>
                    <th className="px-6 py-4">{t("Actor")}</th>
                    <th className="px-6 py-4">{t("Status")}</th>
                    <th className="px-6 py-4">{t("Date & Time")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredHistory.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="px-6 py-4"><EventBadge type={row.type} /></td>
                      <td className="px-6 py-4 text-slate-700 max-w-[260px] truncate">{t(row.description)}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">{row.target}</td>
                      <td className="px-6 py-4 text-slate-700">{row.actor}</td>
                      <td className="px-6 py-4">{statusBadge(row.status)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {row.date ? new Date(row.date).toLocaleString(getLocale(), { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Singapore' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      {/* ─── REVIEW MODAL ─── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {reviewModal.action === 'APPROVED' ? t("Approve") : t("Reject")}{' '}
              {reviewModal.type === 'ALLOCATION' ? t("Allocation") : reviewModal.type === 'BUDGET' ? t("Budget Request") : t("Staff Registration")}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              {reviewModal.type === 'ALLOCATION' && <><strong>{reviewModal.item.staff_name || reviewModal.item.staff_email}</strong>{" "}{t("— {project_code} • {formatHours} hrs", { project_code: reviewModal.item.project_code, formatHours: formatHours(reviewModal.item.hours_requested ?? reviewModal.item.hours_per_week) })}</>}
              {reviewModal.type === 'BUDGET' && <><strong>{reviewModal.item.project_code}</strong> — {reviewModal.item.project_name || reviewModal.item.project_code}{" "}{t("• {formatHours} hrs requested", { formatHours: formatHours(reviewModal.item.requested_hours) })}</>}
              {reviewModal.type === 'STAFF' && <><strong>{reviewModal.item.full_name}</strong> — {reviewModal.item.email}</>}
            </p>

            {reviewModal.type !== 'STAFF' && (
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t("Remark")}{" "}{reviewModal.action === 'REJECTED' ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">{t("(optional)")}</span>}
                </label>
                <textarea
                  rows={3}
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                  placeholder={reviewModal.action === 'REJECTED' ? t("Explain why this is being rejected…") : t("Add a note…")}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {reviewError && <p className="mt-2 text-sm font-medium text-red-500">{reviewError}</p>}
              </div>
            )}

            {feedback && (
              <p className={`mb-4 text-sm font-medium ${feedback.includes('Done') ? 'text-green-600' : 'text-red-500'}`}>{feedback}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setReviewModal(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700"
              >{t("Cancel")}</button>
              <button
                onClick={submitModalReview}
                disabled={submitting}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${reviewModal.action === 'APPROVED' ? 'bg-[#1540A8] hover:bg-[#12378F]' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {submitting ? t("Submitting…") : reviewModal.action === 'APPROVED' ? t("Confirm Approve") : t("Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl bg-slate-900 px-5 py-4 text-sm font-medium text-white shadow-2xl">
          <span>{t(toast.message)}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">&times;</button>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

export default function ApprovalsPage() {
  const { t } = useT();
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">{t("Loading…")}</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}
