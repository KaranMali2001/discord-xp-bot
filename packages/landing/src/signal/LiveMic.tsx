import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type CSSProperties, useEffect, useState } from 'react'
import { discussionQuestions } from './data'

const spring = { type: 'spring' as const, stiffness: 180, damping: 22 }

export function LiveMic() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % discussionQuestions.length),
      2800,
    )
    return () => window.clearInterval(timer)
  }, [reduceMotion])

  return (
    <div className="live-mic" aria-label="Questions from Tech Talks Friday discussions">
      <div className="live-mic__signal-rings" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          className="live-mic__question"
          key={discussionQuestions[active]}
          initial={reduceMotion ? false : { opacity: 0, x: 28, y: 12, rotate: 2 }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: -1 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -20, y: -12, rotate: -2 }}
          transition={spring}
        >
          {discussionQuestions[active]}
        </motion.p>
      </AnimatePresence>

      <motion.div
        className="live-mic__body"
        animate={reduceMotion ? undefined : { y: [0, -10, 0], rotate: [-1.5, 1.5, -1.5] }}
        transition={{ duration: 6.4, repeat: Number.POSITIVE_INFINITY, ease: [0.37, 0, 0.63, 1] }}
      >
        <img
          className="live-mic__brand-image"
          src="/signal/tech-talks-mark-v2.png"
          alt="Tech Talks microphone shaped by flowing sound waves"
          width="1254"
          height="1254"
        />
      </motion.div>

      <div className="live-mic__topics" aria-hidden="true">
        {['React', 'Redis', 'TCP', 'Next.js', 'SSE', 'Databases'].map((topic, index) => (
          <motion.span
            key={topic}
            style={{ '--topic-index': index } as CSSProperties}
            animate={
              reduceMotion ? undefined : { opacity: [0.42, 0.86, 0.42], scale: [0.98, 1.03, 0.98] }
            }
            transition={{
              duration: 4 + index * 0.22,
              delay: index * 0.12,
              repeat: Number.POSITIVE_INFINITY,
              ease: [0.45, 0, 0.55, 1],
            }}
          >
            {topic}
          </motion.span>
        ))}
      </div>
    </div>
  )
}
