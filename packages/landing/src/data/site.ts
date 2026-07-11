// Central content model. Every concept page reads from here, so swapping in real
// crew, sessions, and copy later means editing one file — not many layouts.

export interface Social {
  label: string; // "X", "GitHub", "LinkedIn", "Site"
  href: string;
}

export interface CrewMember {
  name: string;
  role: string;
  blurb: string;
  initials: string;
  tint: string; // avatar accent; overridden per-concept where needed
  handle: string;
  socials: Social[]; // 3-4 links, shown in the constellation popover
}

export interface Session {
  ep: string; // "042"
  date: string; // human short, e.g. "Jul 10"
  iso: string; // machine date
  title: string;
  topic: string; // short category tag
  speaker: string;
}

export interface Contribution {
  type: 'Blog' | 'Video' | 'Talk' | 'Repo';
  title: string;
  author: string; // matches a crew member name
  date: string;
  iso: string;
  href: string;
  blurb: string;
}

export const site = {
  name: 'Tech Talks',
  tagline: 'We talk code, every Friday.',
  blurb:
    'A developer broadcast and mock-interview crew. Live sessions every Friday, run by engineers who actually ship.',
  handle: '@Techtalks07122',
  xUrl: 'https://x.com/Techtalks07122',
  cadence: 'Fridays · 19:00 IST',
  station: '88.7 FRIDAY FM',
  since: '2025',
  membersCount: 480, // organic-ish, not a round number
};

// Placeholder crew — realistic on purpose. Swap names/photos/links at build time.
export const crew: CrewMember[] = [
  {
    name: 'Atharv Dange',
    role: 'Host & Founder',
    blurb: 'Runs the Friday desk and keeps the mic warm. Backend by trade, teacher by habit.',
    initials: 'AD',
    tint: '#7C6CF0',
    handle: '@atharv',
    socials: [
      { label: 'X', href: 'https://x.com/atharv' },
      { label: 'GitHub', href: 'https://github.com/atharvd' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/atharv-dange' },
      { label: 'Site', href: 'https://atharv.dev' },
    ],
  },
  {
    name: 'Sneha Kulkarni',
    role: 'Sessions Lead',
    blurb: 'Books the lineup and turns raw topics into tight, 45-minute walkthroughs.',
    initials: 'SK',
    tint: '#4FA9F0',
    handle: '@sneha.k',
    socials: [
      { label: 'X', href: 'https://x.com/snehakulkarni' },
      { label: 'GitHub', href: 'https://github.com/snehak' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/sneha-kulkarni' },
    ],
  },
  {
    name: 'Rohit Verma',
    role: 'Mock Interviews',
    blurb: 'Sits across the table so the real one feels routine. DSA and system design.',
    initials: 'RV',
    tint: '#F0A24F',
    handle: '@rohitv',
    socials: [
      { label: 'X', href: 'https://x.com/rohitv' },
      { label: 'GitHub', href: 'https://github.com/rohitv' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/rohit-verma' },
      { label: 'Site', href: 'https://rohit.codes' },
    ],
  },
  {
    name: 'Priya Nair',
    role: 'Community & Ops',
    blurb: 'Keeps the room welcoming and the calendar honest. First reply you get when you join.',
    initials: 'PN',
    tint: '#48C5A0',
    handle: '@priya',
    socials: [
      { label: 'X', href: 'https://x.com/priya' },
      { label: 'GitHub', href: 'https://github.com/priyanair' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/priya-nair' },
    ],
  },
  {
    name: 'Kabir Anand',
    role: 'Content & Archive',
    blurb: 'Cuts every session into notes and reruns so nothing said on Friday gets lost.',
    initials: 'KA',
    tint: '#E06C9F',
    handle: '@kabir',
    socials: [
      { label: 'X', href: 'https://x.com/kabir' },
      { label: 'GitHub', href: 'https://github.com/kabira' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/kabir-anand' },
      { label: 'Site', href: 'https://kabir.blog' },
    ],
  },
];

// Past-session archive, newest first. EP.042 is the latest ("Monorepos from Scratch").
export const sessions: Session[] = [
  { ep: '042', date: 'Jul 10', iso: '2026-07-10', title: 'Monorepos from Scratch', topic: 'Tooling', speaker: 'Atharv Dange' },
  { ep: '041', date: 'Jul 03', iso: '2026-07-03', title: 'System Design: Rate Limiters', topic: 'Systems', speaker: 'Rohit Verma' },
  { ep: '040', date: 'Jun 26', iso: '2026-06-26', title: 'React Internals: the Fiber Tree', topic: 'Frontend', speaker: 'Sneha Kulkarni' },
  { ep: '039', date: 'Jun 19', iso: '2026-06-19', title: 'Postgres Indexing, Deep Dive', topic: 'Databases', speaker: 'Kabir Anand' },
  { ep: '038', date: 'Jun 12', iso: '2026-06-12', title: 'Cracking the DSA Interview', topic: 'Interview', speaker: 'Rohit Verma' },
  { ep: '037', date: 'Jun 05', iso: '2026-06-05', title: 'Type-Safe APIs with tRPC', topic: 'Backend', speaker: 'Priya Nair' },
];

// The next scheduled session (shown as the hero's "on air / this friday" card).
export const nextSession = sessions[0];

// Community contributions — things members shipped beyond the Friday sessions.
// Placeholder links; swap hrefs at build time.
export const contributions: Contribution[] = [
  { type: 'Blog', title: 'Why our monorepo migration took three tries', author: 'Atharv Dange', date: 'Jul 08', iso: '2026-07-08', href: '#', blurb: 'The tooling traps we hit moving 40 packages onto one graph — and what finally stuck.' },
  { type: 'Video', title: 'React internals on a whiteboard', author: 'Sneha Kulkarni', date: 'Jun 30', iso: '2026-06-30', href: '#', blurb: 'A 20-minute redraw of the fiber tree, reconciliation, and why keys matter.' },
  { type: 'Repo', title: 'friday-notes — open notes from every session', author: 'Kabir Anand', date: 'Jun 27', iso: '2026-06-27', href: '#', blurb: 'Markdown notes, diagrams, and links for all 42 sessions. PRs welcome.' },
  { type: 'Talk', title: 'Rate limiting at scale', author: 'Rohit Verma', date: 'Jun 21', iso: '2026-06-21', href: '#', blurb: 'The token-bucket vs sliding-window talk from EP.041, cleaned up for a meetup.' },
  { type: 'Blog', title: 'A mental model for Postgres indexes', author: 'Kabir Anand', date: 'Jun 15', iso: '2026-06-15', href: '#', blurb: 'When B-tree beats hash, what covering indexes buy you, and how to read EXPLAIN.' },
  { type: 'Video', title: 'Mock interview teardown: a real DSA round', author: 'Rohit Verma', date: 'Jun 09', iso: '2026-06-09', href: '#', blurb: 'A recorded mock with commentary — where the candidate stalled and how to recover.' },
];
