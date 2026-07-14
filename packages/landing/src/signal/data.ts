export interface SignalMember {
  name: string
  role: string
  roleKind: 'founder' | 'community' | 'server' | 'events' | 'mentor'
  description: string
  initials: string
  hue: string
  image: string
  imagePosition: string
  socials?: {
    x?: string
    github?: string
    portfolio?: string
  }
}

export interface AudioSession {
  title: string
  topic: string
  host: string
  listeners: string[]
  image: string
  alt: string
  duration: string
  sampleProgress: number
  audioSrc?: string
}

export const signalMembers: SignalMember[] = [
  {
    name: 'Priyanshu',
    role: 'Community Founder',
    roleKind: 'founder',
    description: 'Sets the direction and keeps every Friday conversation worth showing up for.',
    initials: 'PR',
    hue: '#d89b55',
    image: '/signal/member-priyanshu.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Karan',
    role: 'Learning Guide',
    roleKind: 'mentor',
    description: 'Connects the reading to real engineering work and makes space for follow-up questions.',
    initials: 'KA',
    hue: '#6f82aa',
    image: '/signal/member-karan.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Saumya',
    role: 'Community Curator',
    roleKind: 'community',
    description: 'Shapes the room, welcomes new voices and turns questions into useful conversations.',
    initials: 'SA',
    hue: '#cb766f',
    image: '/signal/member-saumya.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Atharv',
    role: 'Learning Guide',
    roleKind: 'mentor',
    description: 'Explains difficult topics clearly and helps the room build a stronger mental model.',
    initials: 'AT',
    hue: '#aa8d61',
    image: '/signal/member-atharv.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Saif',
    role: 'Event Producer',
    roleKind: 'events',
    description: 'Plans sessions, handles the moving parts and keeps discussion nights on track.',
    initials: 'SF',
    hue: '#8e80aa',
    image: '/signal/member-saif.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Affan',
    role: 'Event Producer',
    roleKind: 'events',
    description: 'Coordinates the lineup and handles the details that make events feel effortless.',
    initials: 'AF',
    hue: '#b97f97',
    image: '/signal/member-affan.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Saurav',
    role: 'Event Producer',
    roleKind: 'events',
    description: 'Builds the event rhythm and makes sure every session has energy and shape.',
    initials: 'SO',
    hue: '#6f9186',
    image: '/signal/member-saurav.png',
    imagePosition: '50% 50%',
  },
  {
    name: 'Hayat',
    role: 'Discord Steward',
    roleKind: 'server',
    description: 'Keeps the Discord server organised, reliable and easy to participate in.',
    initials: 'HA',
    hue: '#6991a3',
    image: '/signal/member-hayat.png',
    imagePosition: '50% 50%',
  },
]

export const discussionQuestions = [
  'It depends…',
  'When should SSE beat WebSockets?',
  'What actually happens after an IP lookup?',
  'Why does Redis feel so fast?',
  'TCP or UDP for this problem?',
  'How does React decide what to rerender?',
  'Where should a database index begin?',
  'What changes when Next.js runs on the server?',
]

export const audioSessions: AudioSession[] = [
  {
    title: 'WebSockets, SSE and the live web',
    topic: 'Realtime systems',
    host: 'Priyanshu',
    listeners: ['Saumya', 'Hayat', 'Saurav'],
    image: '/signal/friday-circle.webp',
    alt: 'Developers gathered around a classic microphone during a late-night discussion',
    duration: '42 min',
    sampleProgress: 38,
  },
  {
    title: 'Redis beyond the cache',
    topic: 'Databases',
    host: 'Saumya',
    listeners: ['Priyanshu', 'Affan', 'Karan'],
    image: '/signal/community-session.webp',
    alt: 'A small developer community discussing systems around a shared table',
    duration: '38 min',
    sampleProgress: 61,
  },
  {
    title: 'React, Next.js and the server boundary',
    topic: 'Frontend',
    host: 'Atharv',
    listeners: ['Saif', 'Karan', 'Hayat'],
    image: '/signal/brand-spectrum.webp',
    alt: 'Tech Talks microphone on a muted multicolor spectrum background',
    duration: '46 min',
    sampleProgress: 24,
  },
  {
    title: 'Choosing TCP or UDP',
    topic: 'Networks',
    host: 'Hayat',
    listeners: ['Saumya', 'Saif', 'Atharv'],
    image: '/signal/friday-circle.webp',
    alt: 'A developer discussion gathered around a microphone',
    duration: '41 min',
    sampleProgress: 47,
  },
]
