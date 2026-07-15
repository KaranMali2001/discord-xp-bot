import {
  CalendarDotsIcon,
  ChalkboardTeacherIcon,
  CrownSimpleIcon,
  DiscordLogoIcon,
  GithubLogoIcon,
  GlobeSimpleIcon,
  UsersThreeIcon,
  XLogoIcon,
} from '@phosphor-icons/react'
import { useReducedMotion } from 'motion/react'
import type { CSSProperties, ElementType } from 'react'
import { useEffect, useRef, useState } from 'react'
import { signalMembers, type SignalMember } from '../signal/data'

const roleIcons: Record<SignalMember['roleKind'], ElementType> = {
  founder: CrownSimpleIcon,
  community: UsersThreeIcon,
  server: DiscordLogoIcon,
  events: CalendarDotsIcon,
  mentor: ChalkboardTeacherIcon,
}

function SocialLinks({ member }: { member: SignalMember }) {
  const socials = [
    { label: 'X', href: member.socials?.x, Icon: XLogoIcon },
    { label: 'GitHub', href: member.socials?.github, Icon: GithubLogoIcon },
    { label: 'Portfolio', href: member.socials?.portfolio, Icon: GlobeSimpleIcon },
  ]

  return (
    <div className="crew-member__socials" aria-label={`${member.name} links`}>
      {socials.map(({ label, href, Icon }) =>
        href ? (
          <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={`${member.name} on ${label}`}>
            <Icon size={16} weight="light" aria-hidden="true" />
          </a>
        ) : (
          <span key={label} aria-label={`${label} link pending`} title={`${label} link pending`}>
            <Icon size={16} weight="light" aria-hidden="true" />
          </span>
        ),
      )}
    </div>
  )
}

export default function CrewOrbitSection() {
  const orbitRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const [rotationAngle, setRotationAngle] = useState(0)
  const [radius, setRadius] = useState(180)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [compactLayout, setCompactLayout] = useState(false)
  const activeIndex = hoveredIndex ?? focusedIndex ?? selectedIndex

  useEffect(() => {
    const orbit = orbitRef.current
    if (!orbit) return

    const updateRadius = () => setRadius(Math.max(118, Math.min(200, orbit.clientWidth * 0.37)))
    updateRadius()

    const observer = new ResizeObserver(updateRadius)
    observer.observe(orbit)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const updateLayout = () => setCompactLayout(media.matches)
    updateLayout()
    media.addEventListener('change', updateLayout)
    return () => media.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (activeIndex !== null || reduceMotion || compactLayout) return

    const timer = window.setInterval(() => {
      setRotationAngle((current) => Number(((current + 0.3) % 360).toFixed(3)))
    }, 50)

    return () => window.clearInterval(timer)
  }, [activeIndex, compactLayout, reduceMotion])

  return (
    <div
      className="crew-orbit"
      ref={orbitRef}
      onClick={() => {
        setSelectedIndex(null)
        setFocusedIndex(null)
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      }}
    >
      <div className="crew-orbit__field" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="crew-orbit__core" aria-label="Tech Talks microphone broadcasting to the team">
        <img src="/signal/brand-mic-alpha.png" alt="Tech Talks microphone" width="900" height="900" />
      </div>

      <div className="crew-orbit__members">
        {signalMembers.map((member, index) => {
          const RoleIcon = roleIcons[member.roleKind]
          const angle = (index / signalMembers.length) * 360 + rotationAngle - 90
          const radians = (angle * Math.PI) / 180
          const x = Math.cos(radians) * radius
          const y = Math.sin(radians) * radius
          const depth = (Math.sin(radians) + 1) / 2
          const isActive = activeIndex === index
          const popoverSide = y >= 0 ? 'top' : 'bottom'
          const popoverAlign = x < -radius * 0.32 ? 'left' : x > radius * 0.32 ? 'right' : 'center'
          const style = {
            '--member-x': `${x.toFixed(2)}px`,
            '--member-y': `${y.toFixed(2)}px`,
            '--member-opacity': isActive ? 1 : Number((0.58 + depth * 0.42).toFixed(3)),
            '--member-scale': isActive ? 1.08 : Number((0.88 + depth * 0.14).toFixed(3)),
            '--member-layer': isActive ? 240 : Math.round(10 + depth * 90),
            '--member-hue': member.hue,
            '--member-index': index,
            '--member-image-position': member.imagePosition,
          } as CSSProperties

          return (
            <article
              className={`crew-member${isActive ? ' is-active' : ''}`}
              key={member.name}
              style={style}
              tabIndex={0}
              aria-expanded={isActive}
              data-popover-side={popoverSide}
              data-popover-align={popoverAlign}
              onPointerEnter={() => {
                setHoveredIndex(index)
                setFocusedIndex((current) => current === index ? current : null)
                setSelectedIndex((current) => current === index ? current : null)
              }}
              onPointerLeave={() => setHoveredIndex((current) => current === index ? null : current)}
              onFocus={() => {
                setFocusedIndex(index)
                setSelectedIndex((current) => current === index ? current : null)
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedIndex(null)
              }}
              onClick={(event) => {
                event.stopPropagation()
                if (event.target instanceof HTMLElement && event.target.closest('a')) return
                setSelectedIndex(index)
                setFocusedIndex(index)
              }}
            >
              <div className="crew-member__presence">
                <div className="crew-member__portrait">
                  <img src={member.image} alt="" width="1254" height="1254" loading="lazy" />
                  <span className="crew-member__role-icon" aria-hidden="true">
                    <RoleIcon size={23} weight="light" />
                  </span>
                </div>
                <strong className="crew-member__name">{member.name}</strong>
              </div>

              <div className="crew-member__popover" aria-hidden={!isActive}>
                <div className="crew-member__popover-heading">
                  <span>
                    <RoleIcon size={18} weight="light" aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.role}</small>
                  </div>
                </div>
                <p>{member.description}</p>
                <SocialLinks member={member} />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
