import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { discussionQuestions } from './data'

export function LiveMic() {
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()

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

      <AnimatePresence initial={false} mode="sync">
        <motion.p
          className={`live-mic__question${active === 0 ? ' is-tagline' : ''}`}
          data-side={side}
          key={discussionQuestions[active]}
          aria-live="polite"
          initial={reduceMotion ? false : { opacity: 0, x: side === 'left' ? 12 : -12, y: 6, scale: 0.98, filter: 'blur(4px)' }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.985, filter: 'blur(2px)' }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
        >
          {discussionQuestions[active]}
        </motion.p>
      </AnimatePresence>

      <div className="live-mic__body">
        <img
          className="live-mic__brand-image"
          src="/signal/brand-mic-alpha.webp"
          alt="Tech Talks microphone shaped by flowing sound waves"
          width="900"
          height="900"
        />
      </div>
    </div>
  )
}
