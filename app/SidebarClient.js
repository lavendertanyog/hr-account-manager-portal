"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { authHeaders, endSession } from './authSession';

function deriveNameFromEmail(email) {
  return String(email || '')
    .split('@')[0].split('.').filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: 'grid' },
  { label: 'Projects', href: '/my-projects', icon: 'folder' },
  { label: 'Team', href: '/team', icon: 'users' },
  { label: 'Progress', href: '/progress', icon: 'trending' },
  { label: 'Reports', href: '/reports', icon: 'chart' },
  { label: 'Calendar', href: '/calendar', icon: 'calendar' },
];

function NavIcon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'grid':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
    case 'folder':
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>;
    case 'users':
      return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'trending':
      return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    case 'chart':
      return <svg {...common}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case 'logout':
      return <svg {...common}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 5 12 10 7" /><line x1="5" y1="12" x2="17" y2="12" /></svg>;
    default:
      return null;
  }
}

// The content card's colour (see AppShell). The open tab's capsule uses it too.
export const PAGE_BG = '#F7F9FD';

// Module-level: resets on every full page reload.
let _am_lastVerified = 0;

export default function SidebarClient({ isDrawer = false, onClose, collapsed = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [logoMissing, setLogoMissing] = useState(false);
  const navRef = useRef(null);

  // Keep the open page's tab in view when the tab list has to scroll.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);

  // On a shorter screen (most laptops) the full-size tabs don't all fit above Profile and
  // Log out, so the rail switches to a compact size; the tab list still scrolls if even that
  // doesn't fit.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () => setCompact(window.innerHeight < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('am_portal_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, [pathname]);

  // Re-verify roles against DB on each navigation (always on page load, throttled 3 min in-page)
  useEffect(() => {
    const stored = sessionStorage.getItem('am_portal_user');
    if (!stored) return;
    const u = JSON.parse(stored);
    if (!u?.user_id) return;
    if (Date.now() - _am_lastVerified < 3 * 60 * 1000) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';
    fetch(`${API_BASE}/api/v1/auth/verify-session?userId=${u.user_id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) { handleLogout(); return; }
        const { user_roles, user_role, account_status } = payload.data;
        const roles = Array.isArray(user_roles) && user_roles.length > 0 ? user_roles : [user_role].filter(Boolean);
        const active = String(account_status || 'active').toLowerCase() === 'active';
        const hasAccess = active && roles.includes('account_manager');
        _am_lastVerified = Date.now();
        if (!hasAccess) handleLogout();
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hr-backend-qjww.onrender.com';
    const id = setInterval(() => {
      const stored = sessionStorage.getItem('am_portal_user');
      if (!stored) return;
      const u = JSON.parse(stored);
      if (!u?.user_id) return;
      fetch(`${API_BASE}/api/v1/auth/verify-session?userId=${u.user_id}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((payload) => {
          if (!payload.success) { handleLogout(); return; }
          const { user_roles, user_role, account_status } = payload.data;
          const roles = Array.isArray(user_roles) && user_roles.length > 0 ? user_roles : [user_role].filter(Boolean);
          const hasAccess = String(account_status || 'active').toLowerCase() === 'active' && roles.includes('account_manager');
          _am_lastVerified = Date.now();
          if (!hasAccess) handleLogout();
        }).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    endSession();
    sessionStorage.removeItem('am_portal_user');
    router.push('/');
  };

  if (!user) return null;

  const displayName = user?.full_name || deriveNameFromEmail(user?.email) || 'Account Manager';
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || 'AM';

  // Mobile drawer keeps the full-width list layout — the icon rail below is desktop-only.
  if (isDrawer) {
    return (
      <aside className="flex flex-col bg-white" style={{ width: 280, minHeight: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 50, boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Navigation</span>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center" style={{ padding: '28px 24px 20px' }}>
          <img src="/nextan-logo.png" alt="Nextan" width={150} height={45} className="object-contain" />
        </div>

        <nav className="flex-1 px-3" style={{ paddingTop: 8 }}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 rounded-2xl text-sm font-medium transition-colors"
                style={{
                  padding: '13px 18px',
                  marginBottom: 6,
                  background: active ? '#e8edf8' : 'white',
                  color: active ? '#1a3a8f' : '#374151',
                  fontWeight: active ? 600 : 500,
                }}>
                <NavIcon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-5 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-3 rounded-2xl" style={{ background: '#f5f7fc', padding: '12px 14px' }}>
            <Link href="/profile" className="flex items-center gap-3 flex-1 overflow-hidden" title="View profile">
              <div className="flex items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0"
                style={{ width: 38, height: 38, background: '#1a3a8f', fontSize: 13 }}>
                {initials}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate" style={{ color: '#111827', lineHeight: 1.3 }}>{displayName}</p>
                <p className="text-xs truncate" style={{ color: '#6b7280', marginTop: 1 }}>Account Manager</p>
              </div>
            </Link>
            <button onClick={handleLogout} title="Log out"
              className="flex-shrink-0 flex items-center justify-center rounded-lg transition hover:bg-red-50"
              style={{ width: 30, height: 30, color: '#9ca3af' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Desktop: the navy icon rail. AppShell's backdrop is navy, so the rail is just that backdrop
  // showing beside the content card. The open tab is a capsule the colour of the content card.
  // Profile and Log out sit at the bottom in the same style. Collapsing (icons only) is driven by
  // the menu button in the top bar, via AppShell.
  const RAIL_W = collapsed ? 64 : 140;

  const railItemStyle = (active) => ({
    width: collapsed ? (active ? 44 : 40) : compact ? (active ? 76 : 64) : (active ? 80 : 69),
    height: collapsed ? (active ? 44 : 40) : compact ? (active ? 70 : 50) : (active ? 132 : 69),
    borderRadius: collapsed ? (active ? 14 : 12) : compact ? (active ? 28 : 16) : (active ? 40 : 18),
    margin: collapsed ? (active ? '6px 0' : '4px 0') : compact ? (active ? '8px 0' : '3px 0') : (active ? '18px 0' : '6px 0'),
    gap: compact ? 5 : 7,
    background: active ? PAGE_BG : 'transparent',
    color: active ? '#16307a' : '#aab8e0',
  });
  const railLabel = (text, active) => !collapsed && (
    <span style={{ fontSize: 11, fontWeight: active ? 600 : 500, lineHeight: 1 }}>{text}</span>
  );
  const profileActive = pathname.startsWith('/profile');

  return (
    <aside className="flex flex-col flex-shrink-0" style={{ width: RAIL_W, transition: 'width 200ms ease', padding: '10px 0' }}>
      {/* Logo */}
      <div className="flex items-center justify-center" style={{ paddingTop: collapsed ? 20 : compact ? 24 : 38, paddingBottom: 4 }}>
        {collapsed ? (
          <span className="text-lg font-extrabold text-white" aria-label="Nextan">n</span>
        ) : !logoMissing ? (
          <img src="/nextan-logo.png" alt="Nextan" width={compact ? 120 : 156} height={compact ? 36 : 48}
            className="object-contain brightness-0 invert"
            onError={() => setLogoMissing(true)} />
        ) : (
          <span className="text-sm font-bold text-white tracking-tight">nextan</span>
        )}
      </div>

      {/* The tabs scroll when they don't all fit, so none end up hidden behind the bottom items. */}
      <nav ref={navRef} aria-label="Main" className="flex flex-col items-center overflow-y-auto hide-native-scrollbar" style={{ paddingTop: 16, flex: 1, minHeight: 0 }}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center transition-all flex-shrink-0 ${active ? '' : 'hover:bg-white/10 hover:text-white'}`}
              style={railItemStyle(active)}>
              <NavIcon name={item.icon} size={active ? 20 : 18} />
              {railLabel(item.short || item.label, active)}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 8, borderTop: '1px solid rgba(170,184,224,0.2)', margin: '0 12px' }}>
        <Link href="/profile" title="Profile" aria-label="Profile"
          aria-current={profileActive ? 'page' : undefined}
          className={`flex flex-col items-center justify-center transition-all flex-shrink-0 ${profileActive ? '' : 'hover:bg-white/10 hover:text-white'}`}
          style={railItemStyle(profileActive)}>
          <NavIcon name="user" size={profileActive ? 20 : 18} />
          {railLabel('Profile', profileActive)}
        </Link>
        <button type="button" onClick={handleLogout} title="Log out" aria-label="Log out"
          className="flex flex-col items-center justify-center transition-all flex-shrink-0 hover:bg-white/10 hover:text-white"
          style={{ ...railItemStyle(false), border: 'none', cursor: 'pointer' }}>
          <NavIcon name="logout" size={18} />
          {railLabel('Log out', false)}
        </button>
      </div>
    </aside>
  );
}
