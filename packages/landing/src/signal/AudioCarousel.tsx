import { PauseIcon, PlayIcon, WaveformIcon } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import { type CSSProperties, useRef, useState } from 'react'
import { audioSessions } from './data'

export function AudioCarousel() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState<number | null>(null)
  const [notice, setNotice] = useState('Choose a recording')
  const audioRefs = useRef<Array<HTMLAudioElement | null>>([])
  const session = audioSessions[active]

  const playSession = async (index: number) => {
    const selected = audioSessions[index]
    const audio = audioRefs.current[index]
    audioRefs.current.forEach((item, itemIndex) => {
      if (item && itemIndex !== index) item.pause()
    })
    setActive(index)

    if (!selected.audioSrc || !audio) {
      setPlaying(null)
      setNotice('Clip coming soon. Add its source in data.ts.')
      return
    }

    if (playing === index) {
      audio.pause()
      setPlaying(null)
      setNotice('Paused')
      return
    }

    try {
      await audio.play()
      setPlaying(index)
      setNotice(`Playing ${selected.title}`)
    } catch {
      setPlaying(null)
      setNotice('Playback could not start. Try again.')
    }
  }

  return (
    <div className="audio-stage">
      <div className="audio-stage__orbit" aria-label="Friday recording covers">
        {audioSessions.map((item, index) => {
          const rawOffset = index - active
          const offset =
            rawOffset > 1
              ? rawOffset - audioSessions.length
              : rawOffset < -1
                ? rawOffset + audioSessions.length
                : rawOffset
          const itemStyle = { '--audio-offset': offset, '--audio-index': index } as CSSProperties
          return (
            <motion.button
              className={`audio-record${index === active ? ' is-active' : ''}${playing === index ? ' is-playing' : ''}`}
              style={itemStyle}
              type="button"
              key={item.title}
              onClick={() => playSession(index)}
              aria-label={`${playing === index ? 'Pause' : 'Play'} ${item.title}`}
              whileHover={reduceMotion ? undefined : { y: -10, rotate: offset * 2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            >
              <span className="audio-record__grooves" aria-hidden="true" />
              <img src={item.image} alt={item.alt} width="1254" height="1254" loading="lazy" />
              <span className="audio-record__play" aria-hidden="true">
                {playing === index ? (
                  <PauseIcon size={23} weight="fill" />
                ) : (
                  <PlayIcon size={23} weight="fill" />
                )}
              </span>
              <audio
                ref={(node) => {
                  audioRefs.current[index] = node
                }}
                src={item.audioSrc}
                preload="none"
                onEnded={() => {
                  setPlaying(null)
                  setNotice('Recording finished')
                }}
              >
                <track kind="captions" />
              </audio>
            </motion.button>
          )
        })}
      </div>

      <motion.article
        className="audio-stage__session"
        key={session.title}
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="audio-stage__now">
          <WaveformIcon size={21} weight="light" aria-hidden="true" />
          <span aria-live="polite">{notice}</span>
        </div>
        <p className="audio-stage__topic">{session.topic}</p>
        <h3>{session.title}</h3>
        <p className="audio-stage__duration">Friday recording, {session.duration}</p>
        <div className="audio-stage__room">
          <div className="audio-stage__host">
            <span>{session.host.slice(0, 2).toUpperCase()}</span>
            <div>
              <small>Host</small>
              <strong>{session.host}</strong>
            </div>
          </div>
          <div className="audio-stage__listeners">
            <small>Listening in</small>
            <ul>
              {session.listeners.map((listener) => (
                <li key={listener} title={listener}>
                  {listener.slice(0, 2).toUpperCase()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.article>
    </div>
  )
}
