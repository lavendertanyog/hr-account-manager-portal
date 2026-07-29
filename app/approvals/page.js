"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function formatDateOnly(d) {
  if (!d) return '—';
  return String(d).slice(0, 10);
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

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('LEAVE');
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [managerId, setManagerId] = useState('');
  const [reviewModal, setReviewModal] = useState(null); // { item, type, isHistory }
  const [reviewAction, setReviewAction] = useState('APPROVED');
  const [reviewRemark, setReviewRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

  useEffect(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('am_portal_user') || '{}');
      if (u?.user_id) setManagerId(u.user_id);
    } catch {}
  }, []);

  const loadPending = useCallback(async () => {
    if (!managerId) return;
    try {
      const leaveRes = await axios.get(`${backendBaseUrl}/api/v1/manager/${managerId}/leave-pending`).catch(() => ({ data: { data: [] } }));
      setLeaveRecords(leaveRes.data.data || []);
    } catch {
      setLeaveRecords([]);
    }
  }, [backendBaseUrl, managerId]);

  const loadHistory = useCallback(async () => {
    if (!managerId) return;
    try {
      const leaveRes = await axios.get(`${backendBaseUrl}/api/v1/manager/${managerId}/leave-all`);
      setHistoryRecords(leaveRes.data.data || []);
    } catch {
      setHistoryRecords([]);
    }
  }, [backendBaseUrl, managerId]);

  useEffect(() => {
    if (!managerId) return;
    loadPending();
    if (activeTab === 'HISTORY') loadHistory();
  }, [activeTab, managerId, loadPending, loadHistory]);

  const openReviewModal = (item, type, isHistory) => {
    setReviewModal({ item, type, isHistory });
    setReviewAction(isHistory ? (item.workflow_status || 'APPROVED') : 'APPROVED');
    setReviewRemark(isHistory ? (item.reviewer_remarks || '') : '');
    setFeedback('');
  };

  const submitModalReview = async () => {
    if (!reviewModal) return;
    setSubmitting(true);
    setFeedback('');
    try {
      const endpoint = reviewModal.isHistory ? '/api/v1/leave/re-review' : '/api/v1/leave/review';
      await axios.patch(`${backendBaseUrl}${endpoint}`, {
        leaveId: reviewModal.item.leave_id,
        reviewerId: managerId,
        action: reviewAction,
        reviewerRemarks: reviewRemark.trim() || undefined,
      });
      setFeedback('Done! Staff has been notified.');
      setTimeout(() => {
        setReviewModal(null);
        loadPending();
        if (reviewModal.isHistory) loadHistory();
      }, 1200);
    } catch (err) {
      setFeedback(err.response?.data?.error || 'Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">Approvals</h1>
          <p className="mt-1 text-sm text-slate-500">Review outstanding leave requests from your team.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { id: 'LEAVE', label: 'Leave Requests', count: leaveRecords.length },
          { id: 'HISTORY', label: 'History', count: 0 },
        ].map((t) => (
          <button
            key={t.id}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${activeTab === t.id ? 'bg-[#1540A8] text-white shadow-[0_8px_20px_rgba(21,64,168,0.22)]' : 'bg-[#E8EEFF] text-[#163EAF]'}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.count > 0 && (
              <span className="inline-flex items-center justify-center rounded-full text-xs w-5 h-5 bg-red-500 text-white">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── LEAVE REQUESTS ─── */}
      {activeTab === 'LEAVE' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Pending Approvals</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Review inbox</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Live data</span>
          </div>
          <div className="space-y-3">
            {leaveRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No pending leave requests.</div>
            ) : leaveRecords.map((item) => (
              <div key={item.leave_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Leave Request</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.full_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{item.category} • START DATE: {formatDateOnly(item.start_date)} - END DATE: {formatDateOnly(item.end_date)}</p>
                    {item.is_late_submission && (
                      <span className="mt-1.5 inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-600">Late submission</span>
                    )}
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => openReviewModal(item, 'LEAVE', false)}
                      className="rounded-2xl bg-[#1540A8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#12378F]"
                    >Approve</button>
                    <button
                      onClick={() => openReviewModal(item, 'LEAVE', false)}
                      className="rounded-2xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 'HISTORY' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Decision History</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">All reviewed requests</h2>
            </div>
          </div>
          {historyRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No reviewed records yet.</div>
          ) : (
            <div className="space-y-3">
              {historyRecords.map((item) => (
                <div key={item.leave_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Leave — {item.full_name}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {item.category} • {formatDateOnly(item.start_date)} → {formatDateOnly(item.end_date)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {statusBadge(item.workflow_status)}
                        {item.reviewer_remarks && <span className="text-xs text-slate-500 italic">"{item.reviewer_remarks}"</span>}
                      </div>
                    </div>
                    <button onClick={() => openReviewModal(item, 'LEAVE', true)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      Edit Decision
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── REVIEW MODAL ─── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">
              {reviewModal.isHistory ? 'Edit Decision' : 'Review Leave Request'}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              <strong>{reviewModal.item.full_name}</strong> — {reviewModal.item.category} •{' '}
              START DATE: {formatDateOnly(reviewModal.item.start_date)} - END DATE: {formatDateOnly(reviewModal.item.end_date)}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Decision</label>
              <div className="flex gap-3">
                {['APPROVED', 'REJECTED'].map((a) => (
                  <button
                    key={a}
                    onClick={() => setReviewAction(a)}
                    className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${
                      reviewAction === a
                        ? a === 'APPROVED' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {a === 'APPROVED' ? '✓ Approve' : '✕ Reject'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Remark <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                rows={3}
                value={reviewRemark}
                onChange={(e) => setReviewRemark(e.target.value)}
                placeholder="Add a note for the staff member…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {feedback && (
              <p className={`mb-4 text-sm font-medium ${feedback.includes('Done') ? 'text-green-600' : 'text-red-500'}`}>{feedback}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setReviewModal(null)}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700"
              >Cancel</button>
              <button
                onClick={submitModalReview}
                disabled={submitting}
                className="rounded-2xl bg-[#1540A8] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : reviewModal.isHistory ? 'Update Decision' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
