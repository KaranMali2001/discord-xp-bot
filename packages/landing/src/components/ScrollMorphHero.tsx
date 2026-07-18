import { useEffect, useRef } from 'react'
import './ScrollMorphHero.css'

const IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80',
  'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=300&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=80',
  'https://images.unsplash.com/photo-1506765515384-028b60a970df?w=300&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&q=80',
  'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=300&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
  'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=300&q=80',
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=300&q=80',
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=300&q=80',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=300&q=80',
  'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=300&q=80',
  'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=300&q=80',
  'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=300&q=80',
  'https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=300&q=80',
  'https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?w=300&q=80',
]

const TOTAL = IMAGES.length
const MAX_SCROLL = 3000

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

// deterministic scatter positions (same as original)
const SCATTER = IMAGES.map((_, i) => {
  const s1 = Math.sin((i + 1) * 12.9898) * 43758.5453
  const s2 = Math.sin((i + 1) * 78.233) * 24634.6345
  const rx = s1 - Math.floor(s1)
  const ry = s2 - Math.floor(s2)
  return { x: (rx - 0.5) * 1500, y: (ry - 0.5) * 1000, rotation: (rx - 0.5) * 180, scale: 0.6, opacity: 0 }
})

interface Props {
  lightMode?: boolean
}

export function ScrollMorphHero({ lightMode = false }: Props) {
  const heroRef = useRef<HTMLElement>(null)
  const cardsRef = useRef<HTMLElement[]>([])
  const centerCopyRef = useRef<HTMLDivElement>(null)
  const visionCopyRef = useRef<HTMLDivElement>(null)

  const state = useRef({
    phase: 'scatter' as 'scatter' | 'line' | 'circle',
    scrollValue: 0,
    morph: 0,
    spin: 0,
    pointerOffset: 0,
    lastTouchY: 0,
  })

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const s = state.current

    function circleTarget(index: number, rect: DOMRect) {
      const radius = Math.min(Math.min(rect.width, rect.height) * 0.35, 350)
      const angle = (index / TOTAL) * 360
      const rad = (angle * Math.PI) / 180
      return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius, rotation: angle + 90, scale: 1, opacity: 1 }
    }

    function arcTarget(index: number, rect: DOMRect) {
      const mobile = rect.width < 768
      const radius = Math.min(rect.width, rect.height * 1.5) * (mobile ? 1.4 : 1.1)
      const baseY = rect.height * (mobile ? 0.35 : 0.25) + radius
      const arcSpan = mobile ? 100 : 130
      const startAngle = -90 - arcSpan / 2
      const step = arcSpan / (TOTAL - 1)
      const spinProg = clamp(s.spin / 360, 0, 1)
      const angle = startAngle + index * step - spinProg * arcSpan * 0.8
      const rad = (angle * Math.PI) / 180
      return {
        x: Math.cos(rad) * radius + s.pointerOffset,
        y: Math.sin(rad) * radius + baseY,
        rotation: angle + 90,
        scale: mobile ? 1.4 : 1.8,
        opacity: 1,
      }
    }

    function targetFor(index: number, rect: DOMRect) {
      if (s.phase === 'scatter') return SCATTER[index]
      if (s.phase === 'line') {
        const width = TOTAL * 70
        return { x: index * 70 - width / 2, y: 0, rotation: 0, scale: 1, opacity: 1 }
      }
      const c = circleTarget(index, rect)
      const a = arcTarget(index, rect)
      return {
        x: lerp(c.x, a.x, s.morph),
        y: lerp(c.y, a.y, s.morph),
        rotation: lerp(c.rotation, a.rotation, s.morph),
        scale: lerp(1, a.scale, s.morph),
        opacity: 1,
      }
    }

    function setCopy() {
      const cc = centerCopyRef.current
      const vc = visionCopyRef.current
      if (!cc || !vc) return

      const introVisible = s.phase === 'circle' && s.morph < 0.5
      const introOpacity = introVisible ? 1 - s.morph * 2 : 0
      cc.style.opacity = introOpacity.toFixed(3)
      cc.style.filter = `blur(${introVisible ? 0 : 10}px)`
      cc.style.transform = `translate(-50%, calc(-50% + ${introVisible ? 0 : 20}px))`

      const visionOpacity = clamp((s.morph - 0.8) / 0.2, 0, 1)
      vc.style.opacity = visionOpacity.toFixed(3)
      vc.style.transform = `translate(-50%, ${lerp(20, 0, visionOpacity)}px)`
    }

    function render() {
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      cardsRef.current.forEach((card, i) => {
        const t = targetFor(i, rect)
        card.style.opacity = String(t.opacity)
        card.style.transform = `translate3d(${t.x}px,${t.y}px,0) rotate(${t.rotation}deg) scale(${t.scale})`
      })
      setCopy()
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      s.scrollValue = clamp(s.scrollValue + e.deltaY, 0, MAX_SCROLL)
      s.morph = ease(clamp(s.scrollValue / 600, 0, 1))
      s.spin = clamp(((s.scrollValue - 600) / (MAX_SCROLL - 600)) * 360, 0, 360)
      render()
    }

    function onTouchStart(e: TouchEvent) {
      s.lastTouchY = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      const y = e.touches[0].clientY
      const delta = s.lastTouchY - y
      s.lastTouchY = y
      s.scrollValue = clamp(s.scrollValue + delta, 0, MAX_SCROLL)
      s.morph = ease(clamp(s.scrollValue / 600, 0, 1))
      s.spin = clamp(((s.scrollValue - 600) / (MAX_SCROLL - 600)) * 360, 0, 360)
      render()
    }

    function onPointerMove(e: MouseEvent) {
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      s.pointerOffset = (((e.clientX - rect.left) / rect.width) * 2 - 1) * 100
      if (s.phase === 'circle') render()
    }

    render()
    window.addEventListener('resize', render)
    hero.addEventListener('wheel', onWheel, { passive: false })
    hero.addEventListener('touchstart', onTouchStart, { passive: false })
    hero.addEventListener('touchmove', onTouchMove, { passive: false })
    hero.addEventListener('mousemove', onPointerMove)

    const t1 = setTimeout(() => { s.phase = 'line'; render() }, 500)
    const t2 = setTimeout(() => { s.phase = 'circle'; hero.classList.add('smh-ready'); render() }, 2500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', render)
      hero.removeEventListener('wheel', onWheel)
      hero.removeEventListener('touchstart', onTouchStart)
      hero.removeEventListener('touchmove', onTouchMove)
      hero.removeEventListener('mousemove', onPointerMove)
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="smh-hero"
      data-mode={lightMode ? 'light' : 'dark'}
      aria-label="Scroll morph hero"
    >
      <div ref={centerCopyRef} className="smh-center-copy">
        <h1>The future is built on AI.</h1>
        <p>SCROLL TO EXPLORE</p>
      </div>

      <div ref={visionCopyRef} className="smh-vision-copy">
        <h2>Explore Our Vision</h2>
        <p>
          Discover a world where technology meets creativity.
          <br />
          Scroll through our curated collection of innovations designed to shape the future.
        </p>
      </div>

      <div className="smh-cards-plane">
        {IMAGES.map((src, i) => (
          <article
            key={src}
            ref={(el) => { if (el) cardsRef.current[i] = el }}
            className="smh-flip-card"
          >
            <div className="smh-flip-inner">
              <div className="smh-face smh-front">
                <img src={src} alt={`card-${i}`} draggable={false} />
              </div>
              <div className="smh-face smh-back">
                <span>View</span>
                <span>Details</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <button className="smh-next-pill" aria-label="Next">›</button>
      <div className="smh-hint">Wheel or drag to explore</div>
    </section>
  )
}
