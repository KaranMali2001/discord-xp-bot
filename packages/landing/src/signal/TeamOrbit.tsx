import { GithubLogoIcon, GlobeSimpleIcon, XLogoIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type CSSProperties, useState } from 'react'
import { signalMembers } from './data'

const socialLinks = [
  { label: 'X', Icon: XLogoIcon },
  { label: 'GitHub', Icon: GithubLogoIcon },
  { label: 'Portfolio', Icon: GlobeSimpleIcon },
]

export function TeamOrbit() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(0)
  const member = signalMembers[active]

  return (
    <div className="team-orbit">
      <div className="team-orbit__atmosphere" aria-hidden="true" />
      <div className="team-orbit__rings" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="team-orbit__core" aria-live="polite">
        <img src="/signal/tech-talks-mark-v2.png" alt="" width="1254" height="1254" />
        <AnimatePresence mode="wait">
          <motion.div
            className="team-orbit__identity"
            key={member.name}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <small>Current signal</small>
            <strong>{member.name}</strong>
            <span>{member.role}</span>
            <span className="member-card__links" aria-label={`${member.name} social links`}>
              {socialLinks.map(({ label, Icon }) => (
                <button
                  type="button"
                  disabled
                  aria-label={`${label} link for ${member.name} will be added`}
                  key={label}
                >
                  <Icon size={17} weight="light" aria-hidden="true" />
                </button>
              ))}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <ul className="team-orbit__members" aria-label="Tech Talks team">
        {signalMembers.map((member, index) => {
          const memberStyle = {
            '--member-index': index,
            '--member-count': signalMembers.length,
            '--member-angle': `${(360 / signalMembers.length) * index}deg`,
            '--member-hue': member.hue,
          } as CSSProperties

          return (
            <li className="team-orbit__slot" style={memberStyle} key={member.name}>
              <motion.button
                className={`member-card${active === index ? ' is-active' : ''}`}
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                animate={reduceMotion ? undefined : { y: [0, index % 2 === 0 ? -8 : 8, 0] }}
                whileHover={reduceMotion ? undefined : { scale: 1.12 }}
                transition={{
                  y: {
                    duration: 4.4 + index * 0.18,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: [0.45, 0, 0.55, 1],
                  },
                  scale: { type: 'spring', stiffness: 260, damping: 18 },
                }}
                aria-label={`${member.name}, ${member.role}`}
              >
                <span className="member-card__avatar">{member.initials}</span>
                <span className="member-card__label">
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
