// What's New feed — plain-language, user-facing entries only (no internal bug/ticket
// jargon). Newest first. `id` just needs to increase; it's what "seen" is tracked against.
export const WHATS_NEW = [
  {
    id: 4,
    date: '12 Oct 2026',
    title: 'Budget requests and approvals',
    icon: "shield",
    summary: "Your own projects only, plus tidier approval screens",
    chips: ['Your projects only','Final approval limited','Reject needs a reason'],
    body: 'You now see and approve budget requests only for your own projects, and a few approval screens were tidied up.',
    points: [
      { icon: "filter", lead: "Budget Requests", text: "lists requests for projects you are the Account Manager of" },
      { icon: "shield", lead: "You can no longer give", text: "final approval to another project’s request" },
      { icon: "message", lead: "Rejecting an allocation", text: "on the Dashboard now asks for a reason, the same as on Approvals, and the staff member receives it" },
      { icon: "window", lead: "Bulk Approve", text: "asks in a proper window instead of a browser pop-up" },
      { icon: "users", lead: "Removing someone", text: "from your team or a project now asks you first" },
    ],
  },
  {
    id: 3,
    date: '12 Oct 2026',
    title: 'Reports PDF',
    icon: "file",
    summary: "A new page per section, budget bars, and adaptive supporting detail",
    chips: ['Page per section','Budget bars','Adaptive detail'],
    body: 'The PDF report is easier to read and to hand on.',
    points: [
      { icon: "file", lead: "Each section", text: "starts on a new page" },
      { icon: "chart", lead: "Budget utilisation", text: "is shown as bars" },
      { icon: "calendar", lead: "Supporting detail", text: "adapts to the period: a week, a month, or several months" },
    ],
  },
  {
    id: 2,
    date: '12 Oct 2026',
    title: 'My Projects and company calendar',
    icon: "folder",
    summary: "Project cards, Deployed and Maintenance, and who is on leave",
    chips: ['Project cards','Deployed and Maintenance','Company calendar'],
    body: 'Browse your projects as cards, and see who is on leave.',
    points: [
      { icon: "folder", lead: "My Projects", text: "shows project cards with a detail drawer" },
      { icon: "check", lead: "Projects", text: "can now be Deployed or in Maintenance, and show that status" },
      { icon: "calendar", lead: "New Calendar page", text: "in the sidebar shows approved leave by name, in Month or List view, plus public holidays (leave type and reason stay private)" },
    ],
  },
  {
    id: 1,
    date: '12 Oct 2026',
    title: 'Remember me on this device',
    icon: "signin",
    summary: "Stay signed in on this device for 30 days",
    chips: ['30 days','Remembered devices','Not you?'],
    body: 'Tick "Remember me on this device" when you log in and you’ll stay signed in on that browser for 30 days. Next time, the portal signs you straight in without your password. You’ll be asked to log in once after this update.',
    points: [
      { icon: "signin", lead: "Log out", text: "ends the sign-in but keeps your email filled in, partly hidden" },
      { icon: "users", lead: "Click \"Not you?\"", text: "on the login page to forget the email and use a different account" },
      { icon: "list", lead: "See and sign out", text: "your remembered devices from your Profile page" },
      { icon: "lock", lead: "Changing your password", text: "signs out your other devices" },
      { icon: "shield", lead: "Don’t tick it", text: "on a shared or public computer" },
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
