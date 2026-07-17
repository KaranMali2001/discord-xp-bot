import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminsTab } from '@/features/AdminsTab'
import { AnnouncementsTab } from '@/features/AnnouncementsTab'
import { AttendanceTab } from '@/features/AttendanceTab'
import { BadgesTab } from '@/features/BadgesTab'
import { ChannelsTab } from '@/features/ChannelsTab'
import { ConfigTab } from '@/features/ConfigTab'
import { EventsTab } from '@/features/EventsTab'
import { Header } from '@/features/Header'
import { LeaderboardTab } from '@/features/LeaderboardTab'
import { LevelRewardsTab } from '@/features/LevelRewardsTab'
import { TicketsTab } from '@/features/TicketsTab'
import { VoiceCaptureCard } from '@/features/VoiceCaptureCard'
import { useGuildId } from '@/hooks/useGuildId'
import { EmptyState } from '@/components/States'
import { ServerCog } from 'lucide-react'

const TABS = [
  { value: 'config', label: 'Config' },
  { value: 'channels', label: 'Channels' },
  { value: 'events', label: 'Events' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'rewards', label: 'Level Rewards' },
  { value: 'badges', label: 'Badges' },
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'admins', label: 'Admins' },
] as const

export default function App() {
  const { guildId, setGuildId } = useGuildId()

  return (
    <div className="min-h-screen bg-background">
      <Header guildId={guildId} onGuildIdChange={setGuildId} />

      <main className="container py-6">
        {guildId ? (
          <div className="space-y-6">
            <VoiceCaptureCard guildId={guildId} />
            <Tabs defaultValue="config">
              <TabsList className="flex-wrap">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="config">
                <ConfigTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="channels">
                <ChannelsTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="events">
                <EventsTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="attendance">
                <AttendanceTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="rewards">
                <LevelRewardsTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="badges">
                <BadgesTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="leaderboard">
                <LeaderboardTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="announcements">
                <AnnouncementsTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="tickets">
                <TicketsTab guildId={guildId} />
              </TabsContent>
              <TabsContent value="admins">
                <AdminsTab guildId={guildId} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <EmptyState
            icon={ServerCog}
            title="No guild selected"
            hint="Enter a Discord guild id in the header to load its leveling settings."
            className="py-16"
          />
        )}
      </main>
    </div>
  )
}
