"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import ProjectCards from './ProjectCards';

export default function ProjectCodesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [managerOnlyUsers, setManagerOnlyUsers] = useState([]);
  const [accountManagerUsers, setAccountManagerUsers] = useState([]);
  const [managerUsers, setManagerUsers] = useState([]); // combined, used only for the filter dropdown

  const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('am_portal_user');
      if (!stored) { router.push('/'); return; }
      const u = JSON.parse(stored);
      const roles = Array.isArray(u?.user_roles) ? u.user_roles.map((r) => String(r).toLowerCase()) : [String(u?.user_role || '').toLowerCase()];
      if (!u?.user_id || (!roles.includes('account_manager') && !roles.includes('hr'))) { router.push('/'); return; }
      setSessionUser(u);
      setAuthChecked(true);
    } catch { router.push('/'); }
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [managersRes, amRes] = await Promise.all([
        axios.get(`${backendBaseUrl}/api/v1/users?role=manager`).catch(() => ({ data: { data: [] } })),
        axios.get(`${backendBaseUrl}/api/v1/users?role=account_manager`).catch(() => ({ data: { data: [] } })),
      ]);
      setManagerOnlyUsers(managersRes.data.data || []);
      setAccountManagerUsers(amRes.data.data || []);
      const combined = [...(managersRes.data.data || []), ...(amRes.data.data || [])];
      const seen = new Set();
      setManagerUsers(combined.filter((u) => { if (seen.has(u.user_id)) return false; seen.add(u.user_id); return true; }));
    })();
  }, [backendBaseUrl, authChecked]);

  if (!authChecked) return <div className="p-8 text-slate-500">Loading...</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mt-2 text-4xl font-semibold text-slate-950">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">Create, edit and manage all project codes.</p>
      </div>

      <ProjectCards
        backendBaseUrl={backendBaseUrl}
        sessionUser={sessionUser}
        accountManagerOptions={accountManagerUsers}
        managerOptions={managerOnlyUsers}
        managerFilterOptions={managerUsers}
        requireAccountManager={false}
      />
    </div>
  );
}
