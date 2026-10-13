// What's New feed — plain-language, user-facing entries only (no internal bug/ticket
// jargon). Newest first. `id` just needs to increase; it's what "seen" is tracked against.
export const WHATS_NEW = [
  {
    id: 4,
    date: '12 Oct 2026',
    title: 'Budget requests and approvals',
    body: 'You now see and approve budget requests only for your own projects, and a few approval screens were tidied up.',
    points: [
      'Budget Requests lists requests for projects you are the Account Manager of',
      'You can no longer give final approval to another project’s request',
      'Rejecting an allocation on the Dashboard now asks for a reason, the same as on Approvals, and the staff member receives it',
      'Bulk Approve asks in a proper window instead of a browser pop-up',
      'Removing someone from your team or a project now asks you first',
    ],
  },
  {
    id: 3,
    date: '12 Oct 2026',
    title: 'Reports PDF',
    body: 'The PDF report is easier to read and to hand on.',
    points: [
      'Each section starts on a new page',
      'Budget utilisation is shown as bars',
      'Supporting detail adapts to the period: a week, a month, or several months',
    ],
  },
  {
    id: 2,
    date: '12 Oct 2026',
    title: 'My Projects and company calendar',
    body: 'Browse your projects as cards, and see who is on leave.',
    points: [
      'My Projects shows project cards with a detail drawer',
      'Projects can now be Deployed or in Maintenance, and show that status',
      'New Calendar page in the sidebar shows approved leave by name, in Month or List view, plus public holidays (leave type and reason stay private)',
    ],
  },
  {
    id: 1,
    date: '12 Oct 2026',
    title: 'Remember me on this device',
    body: 'Tick "Remember me on this device" when you log in and you’ll stay signed in on that browser for 30 days. Next time, the portal signs you straight in without your password. You’ll be asked to log in once after this update.',
    points: [
      'Log out ends the sign-in but keeps your email filled in, partly hidden',
      'Click "Not you?" on the login page to forget the email and use a different account',
      'See and sign out your remembered devices from your Profile page',
      'Changing your password signs out your other devices',
      'Don’t tick it on a shared or public computer',
    ],
  },
];
export const WHATS_NEW_LATEST_ID = WHATS_NEW[0].id;
export const WHATS_NEW_SEEN_KEY = 'am_portal_whats_new_seen';

// Short summary shown in the one-time update notice after login (see UpdateNotice.js). Keep it to
// three lines and update it with each release; the full list stays in WHATS_NEW above.
export const WHATS_NEW_NOTICE = {
  portal: "Account Manager portal",
  highlights: [
    { icon: "check", lead: "Budget requests", text: "now show only your own projects" },
    { icon: "chart", lead: "Reports PDF", text: "has a new page per section and budget bars" },
    { icon: "calendar", lead: "Company calendar", text: "shows who is on leave" },
  ],
};
