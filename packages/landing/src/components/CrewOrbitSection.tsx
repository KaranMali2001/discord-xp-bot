import { BookOpen, Calendar, Mic2, Radio, Users } from "lucide-react";
import RadialOrbitalTimeline from "./OrbitTimeline";

// Maps the Tech Talks crew to RadialOrbitalTimeline items.
// All data is defined here so no non-serialisable props (React elements) need
// to cross the Astro → React boundary.
const crewData = [
  {
    id: 1,
    title: "Atharv",
    date: "Since 2025",
    content: "Runs the Friday desk and keeps the mic warm. Backend by trade, teacher by habit.",
    category: "Host & Founder",
    icon: Mic2,
    relatedIds: [2, 3, 4, 5],
    status: "completed" as const,
    energy: 96,
  },
  {
    id: 2,
    title: "Sneha",
    date: "Since 2025",
    content: "Books the lineup and turns raw topics into tight, 45-minute walkthroughs.",
    category: "Sessions Lead",
    icon: Calendar,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 88,
  },
  {
    id: 3,
    title: "Rohit",
    date: "Since 2025",
    content: "Sits across the table so the real interview feels routine. DSA and system design.",
    category: "Mock Interviews",
    icon: Radio,
    relatedIds: [1, 4],
    status: "completed" as const,
    energy: 82,
  },
  {
    id: 4,
    title: "Priya",
    date: "Since 2025",
    content: "Keeps the room welcoming and the calendar honest. First reply you get when you join.",
    category: "Community & Ops",
    icon: Users,
    relatedIds: [1, 5],
    status: "completed" as const,
    energy: 78,
  },
  {
    id: 5,
    title: "Kabir",
    date: "Since 2025",
    content: "Cuts every session into notes and reruns so nothing said on Friday gets lost.",
    category: "Content & Archive",
    icon: BookOpen,
    relatedIds: [1, 2],
    status: "completed" as const,
    energy: 74,
  },
];

export default function CrewOrbitSection() {
  return (
    <RadialOrbitalTimeline
      timelineData={crewData}
      height="680px"
    />
  );
}
