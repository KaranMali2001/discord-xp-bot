export interface SignalMember {
  name: string
  role: string
  initials: string
  hue: string
}

export interface AudioSession {
  title: string
  topic: string
  host: string
  listeners: string[]
  image: string
  alt: string
  duration: string
  audioSrc?: string
}

export const signalMembers: SignalMember[] = [
  { name: 'Priyanshu', role: 'Owner', initials: 'PR', hue: '#e9a23b' },
  { name: 'Saumya', role: 'Community manager', initials: 'SA', hue: '#d97f73' },
  { name: 'Hayat', role: 'Server manager', initials: 'HA', hue: '#7b9fb8' },
  { name: 'Beast', role: 'Event manager', initials: 'BE', hue: '#9b8fc2' },
  { name: 'Saurav', role: 'Event manager', initials: 'SO', hue: '#759b8a' },
  { name: 'Affan', role: 'Event manager', initials: 'AF', hue: '#c88da3' },
  { name: 'Atharv', role: 'Reader and mentor', initials: 'AT', hue: '#b59a68' },
  { name: 'Karan', role: 'Reader and mentor', initials: 'KA', hue: '#788bb0' },
]

export const discussionQuestions = [
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
  },
  {
    title: 'Redis beyond the cache',
    topic: 'Databases',
    host: 'Saumya',
    listeners: ['Priyanshu', 'Affan', 'Karan'],
    image: '/signal/community-session.webp',
    alt: 'A small developer community discussing systems around a shared table',
    duration: '38 min',
  },
  {
    title: 'React, Next.js and the server boundary',
    topic: 'Frontend',
    host: 'Atharv',
    listeners: ['Beast', 'Karan', 'Hayat'],
    image: '/signal/brand-spectrum.webp',
    alt: 'Tech Talks microphone on a muted multicolor spectrum background',
    duration: '46 min',
  },
]
