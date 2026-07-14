import { useEffect, useState } from 'react'
import { discussionQuestions } from './data'

export function LiveMic() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timeout = window.setTimeout(
      () => setActive((current) => (current + 1) % discussionQuestions.length),
      active === 0 ? 3400 : 2700,
    )
    return () => window.clearTimeout(timeout)
  }, [active])

  const side = active % 2 === 0 ? 'left' : 'right'

  return (
    <div className="live-mic" aria-label="Questions from Tech Talks Friday discussions">
      <div className="live-mic__signal-rings" aria-hidden="true">
        <i /><i /><i /><i />
      </div>

      <p
        className={`live-mic__question${active === 0 ? ' is-tagline' : ''}`}
        data-side={side}
        key={discussionQuestions[active]}
        aria-live="polite"
      >
        {discussionQuestions[active]}
      </p>

      <div className="live-mic__body">
        <img
          className="live-mic__brand-image"
          src="/signal/brand-mic-alpha.png"
          alt="Tech Talks microphone shaped by flowing sound waves"
          width="900"
          height="900"
        />
      </div>
    </div>
  )
}
