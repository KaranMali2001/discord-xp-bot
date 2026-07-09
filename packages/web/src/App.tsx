import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BadgesTab } from '@/features/BadgesTab'
import { ChannelsTab } from '@/features/ChannelsTab'
import { ConfigTab } from '@/features/ConfigTab'
import { EventsTab } from '@/features/EventsTab'
import { Header } from '@/features/Header'
import { LeaderboardTab } from '@/features/LeaderboardTab'
import { LevelRewardsTab } from '@/features/LevelRewardsTab'
import { useGuildId } from '@/hooks/useGuildId'

const TABS = [
  { value: 'config', label: 'Config' },
  { value: 'channels', label: 'Channels' },
  { value: 'events', label: 'Events' },
  { value: 'rewards', label: 'Level Rewards' },
  { value: 'badges', label: 'Badges' },
  { value: 'leaderboard', label: 'Leaderboard' },
] as const

export default function App() {
  const { guildId, setGuildId } = useGuildId()

  return (
    <div className="min-h-screen bg-background">
      <Header guildId={guildId} onGuildIdChange={setGuildId} />

      <main className="container py-6">
        {guildId ? (
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
            <TabsContent value="rewards">
              <LevelRewardsTab guildId={guildId} />
            </TabsContent>
            <TabsContent value="badges">
              <BadgesTab guildId={guildId} />
            </TabsContent>
            <TabsContent value="leaderboard">
              <LeaderboardTab guildId={guildId} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Enter a guild id above to get started.
          </div>
        )}
      </main>
    </div>
  )
}
