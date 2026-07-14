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
import type { CSSProperties, ElementType } from 'react'
import { signalMembers, type SignalMember } from '../signal/data'

const roleIcons: Record<SignalMember['roleKind'], ElementType> = {
  founder: CrownSimpleIcon,
  community: UsersThreeIcon,
  server: DiscordLogoIcon,
  events: CalendarDotsIcon,
  mentor: ChalkboardTeacherIcon,
}

const positions = [
  ['50%', '13%'],
  ['76%', '24%'],
  ['87%', '50%'],
  ['76%', '76%'],
  ['50%', '87%'],
  ['24%', '76%'],
  ['13%', '50%'],
  ['24%', '24%'],
]

function positionPopover(target: HTMLElement) {
  const orbit = target.closest('.crew-orbit')?.getBoundingClientRect()
  const member = target.getBoundingClientRect()
  if (!orbit) return

  const memberX = member.left + member.width / 2
  const memberY = member.top + member.height / 2
  const orbitX = orbit.left + orbit.width / 2
  const orbitY = orbit.top + orbit.height / 2

  target.dataset.popoverSide = memberY >= orbitY ? 'top' : 'bottom'
  target.dataset.popoverAlign = memberX < orbitX - orbit.width * 0.22 ? 'left' : memberX > orbitX + orbit.width * 0.22 ? 'right' : 'center'
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
  return (
    <div className="crew-orbit">
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
          const [left, top] = positions[index]
          const style = {
            '--member-left': left,
            '--member-top': top,
            '--member-hue': member.hue,
            '--member-index': index,
            '--member-image-position': member.imagePosition,
          } as CSSProperties

          return (
            <article
              className="crew-member"
              key={member.name}
              style={style}
              tabIndex={0}
              onPointerEnter={(event) => positionPopover(event.currentTarget)}
              onFocus={(event) => positionPopover(event.currentTarget)}
            >
              <div className="crew-member__portrait">
                <img src={member.image} alt="" width="1254" height="1254" loading="lazy" />
                <span className="crew-member__role-icon" aria-hidden="true">
                  <RoleIcon size={23} weight="light" />
                </span>
              </div>
              <strong className="crew-member__name">{member.name}</strong>

              <div className="crew-member__popover">
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
