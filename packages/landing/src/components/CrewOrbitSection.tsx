import { BookOpen, Calendar, Crown, Mic2, Server, Users } from "lucide-react";
import { signalMembers } from "../signal/data";
import RadialOrbitalTimeline, { type TimelineItem } from "./OrbitTimeline";

const iconForRole = (role: string) => {
  if (role === "Owner") return Crown;
  if (role === "Community manager") return Users;
  if (role === "Server manager") return Server;
  if (role === "Event manager") return Calendar;
  if (role === "Reader and mentor") return BookOpen;
  return Mic2;
};

const bioForMember = (name: string): string => {
  const bios: Record<string, string> = {
    Priyanshu: "Calls the room to order and sets the bar for what a good Friday discussion looks like.",
    Saumya: "Keeps the community welcoming and makes sure no question goes unanswered.",
    Hayat: "Runs the server infrastructure so everything stays reliable and fast.",
    Beast: "Coordinates the event calendar and makes sure sessions start on time.",
    Saurav: "Manages events and keeps the energy up on discussion nights.",
    Affan: "Organises the lineup and handles logistics when sessions go long.",
    Atharv: "Brings the reading list and sticks around to answer the questions you didn't ask aloud.",
    Karan: "Reads broadly across the stack and mentors early-career devs finding their footing.",
  };
  return bios[name] ?? "A core part of the Tech Talks crew.";
};

// Connect event managers together, owner to both managers, readers to each other
const relatedMap: Record<string, string[]> = {
  Priyanshu: ["Saumya", "Hayat"],
  Saumya:    ["Priyanshu", "Beast", "Saurav", "Affan"],
  Hayat:     ["Priyanshu", "Atharv", "Karan"],
  Beast:     ["Saumya", "Saurav", "Affan"],
  Saurav:    ["Saumya", "Beast", "Affan"],
  Affan:     ["Saumya", "Beast", "Saurav"],
  Atharv:    ["Hayat", "Karan"],
  Karan:     ["Hayat", "Atharv"],
};

const nameToId = Object.fromEntries(signalMembers.map((m, i) => [m.name, i + 1]));

const crewData: TimelineItem[] = signalMembers.map((member, i) => ({
  id: i + 1,
  title: member.name,
  date: "Since 2025",
  content: bioForMember(member.name),
  category: member.role,
  icon: iconForRole(member.role),
  relatedIds: (relatedMap[member.name] ?? []).map((n) => nameToId[n]).filter(Boolean),
  status: "completed" as const,
  energy: 90 - i * 4,
}));

export default function CrewOrbitSection() {
  return <RadialOrbitalTimeline timelineData={crewData} height="680px" />;
}
