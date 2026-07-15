import { useEffect, useRef, useState } from 'react'
import './SpotlightCard.css'

const THEMES = {
  Default: [210, 120],
  Emerald: [140, 90],
  Violet: [280, 90],
  Amber: [24, 70],
} as const

type ThemeName = keyof typeof THEMES

const CARDS = [
  {
    title: 'Analytics',
    desc: 'Pointer-positioned radial highlight with a bright traveling border.',
  },
  {
    title: 'Security',
    desc: 'CSS variables sync globally so every card responds to the same cursor.',
  },
  {
    title: 'Systems',
    desc: 'Fixed background math gives the glow its marketplace-style spotlight feel.',
  },
]

interface SpotlightCardProps {
  lightMode?: boolean
}

export function SpotlightCard({ lightMode = false }: SpotlightCardProps) {
  const cardRefs = useRef<HTMLElement[]>([])
  const [themeName, setThemeName] = useState<ThemeName>('Default')

  useEffect(() => {
    const [base, spread] = THEMES[themeName]
    cardRefs.current.forEach((card) => {
      card.style.setProperty('--base', String(base))
      card.style.setProperty('--spread', String(spread))
    })
  }, [themeName])

  useEffect(() => {
    function syncPointer(e: PointerEvent) {
      cardRefs.current.forEach((card) => {
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--x', (e.clientX - rect.left).toFixed(2))
        card.style.setProperty('--y', (e.clientY - rect.top).toFixed(2))
        card.style.setProperty('--xp', (e.clientX / window.innerWidth).toFixed(2))
      })
    }
    window.addEventListener('pointermove', syncPointer)
    return () => window.removeEventListener('pointermove', syncPointer)
  }, [])

  return (
    <div className="spotlight-wrap" data-mode={lightMode ? 'light' : 'dark'}>
      <div className="spotlight-controls">
        <select
          value={themeName}
          onChange={(e) => setThemeName(e.target.value as ThemeName)}
        >
          {(Object.keys(THEMES) as ThemeName[]).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <main className="spotlight-stage">
        {CARDS.map((card, i) => (
          <article
            key={card.title}
            ref={(el) => {
              if (el) cardRefs.current[i] = el
            }}
            className="spotlight-card"
          >
            <div className="spotlight-orb" />
            <div className="spotlight-caption">
              <h2>{card.title}</h2>
              <p>{card.desc}</p>
            </div>
          </article>
        ))}
      </main>
    </div>
  )
}
