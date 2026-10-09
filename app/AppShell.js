"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import SidebarClient from './SidebarClient';

const SIDEBAR_PATH_PREFIXES = ['/dashboard', '/my-projects', '/team', '/approvals', '/progress', '/reports', '/calendar', '/profile'];
const MOBILE_MEDIA_QUERY = '(max-width: 860px)';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoMissing, setLogoMissing] = useState(false);
  const scrollRef = useRef(null);

  // The content lives in its own scrollable div (not the window), so Next.js's
  // default scroll-restoration-on-navigate never touches it — reset it manually.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateState = () => {
      setIsMobile(mql.matches);
      if (!mql.matches) {
        setSidebarOpen(false);
      }
    };
    updateState();
    mql.addEventListener?.('change', updateState);
    return () => mql.removeEventListener?.('change', updateState);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setSidebarOpen(false);
  }, [pathname, isMobile]);

  const shouldShowSidebar = Boolean(pathname) && SIDEBAR_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!shouldShowSidebar) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  return (
    <div
      className="flex min-h-screen"
      // Same shell as the Staff and HR portals: the whole page background is navy on desktop,
      // so the icon rail is just this backdrop showing around the white content card.
      style={isMobile ? { background: '#f9fafb' } : { background: '#16307a' }}
    >
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/30" onClick={() => setSidebarOpen(false)} />
      )}

      {(!isMobile || sidebarOpen) && (
        <SidebarClient isDrawer={isMobile} onClose={() => setSidebarOpen(false)} />
      )}

      <main
        className="flex-1 flex flex-col"
        style={isMobile ? { minHeight: '100vh', background: '#f9fafb' } : {
          margin: '10px 10px 10px 0',
          background: '#ffffff',
          borderRadius: 32,
          overflow: 'hidden',
          height: 'calc(100vh - 20px)',
          boxShadow: '0 12px 30px rgba(15, 43, 122, 0.08)',
        }}
      >
        {/* Vertical padding insets the scrollable element (and its scrollbar) from the card's
            rounded top/bottom corners so the scrollbar isn't clipped by the curve. */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0, padding: isMobile ? 0 : '24px 0' }}>
          <div ref={scrollRef} className={`flex-1 overflow-y-auto${isMobile ? '' : ' page-scrollbar'}`} style={isMobile ? undefined : { paddingLeft: 20, paddingRight: 16 }}>
        {isMobile && (
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </button>
            {!logoMissing ? (
              <img src="/nextan-logo.png" alt="Nextan" width={130} height={42}
                className="h-10 w-auto max-w-[130px] object-contain"
                onError={() => setLogoMissing(true)} />
            ) : (
              <span className="text-sm font-bold text-blue-900 tracking-tight">nextan</span>
            )}
          </div>
        )}
        {children}
          </div>
        </div>
      </main>
    </div>
  );
}
