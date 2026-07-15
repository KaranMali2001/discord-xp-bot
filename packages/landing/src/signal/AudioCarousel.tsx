import {
  MicrophoneStageIcon,
  PauseIcon,
  PlayIcon,
  ShuffleIcon,
  UsersThreeIcon,
  WaveformIcon,
} from '@phosphor-icons/react'
import { type CSSProperties, useRef, useState } from 'react'
import { audioSessions } from './data'

export function AudioCarousel() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(audioSessions[0].sampleProgress)
  const [notice, setNotice] = useState('One-minute clip')
  const session = audioSessions[active]

  const chooseSession = (index: number) => {
    audioRef.current?.pause()
    setPlaying(false)
    setActive(index)
    setProgress(audioSessions[index].sampleProgress)
    setNotice('One-minute clip')
  }

  const shuffleSession = () => {
    chooseSession((active + 1) % audioSessions.length)
  }

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!session.audioSrc || !audio) {
      setPlaying(false)
      setNotice('Audio source coming soon')
      return
    }

    if (playing) {
      audio.pause()
      setPlaying(false)
      setNotice('Paused')
      return
    }

    try {
      await audio.play()
      setPlaying(true)
      setNotice(`Playing ${session.topic}`)
    } catch {
      setPlaying(false)
      setNotice('Playback could not start')
    }
  }

  return (
    <div className="audio-stage">
      <div className="audio-stage__mesh" aria-hidden="true">
        <i /><i /><i />
      </div>

      <div className="audio-stage__clips" aria-label="Choose a Friday clip">
        {audioSessions.map((item, index) => (
          <button
            className={index === active ? 'is-active' : ''}
            type="button"
            key={item.title}
            onClick={() => chooseSession(index)}
            aria-pressed={index === active}
          >
            <WaveformIcon size={15} weight="light" aria-hidden="true" />
            {item.topic}
          </button>
        ))}
        <button className="audio-stage__shuffle" type="button" onClick={shuffleSession} aria-label="Show the next clip">
          <ShuffleIcon size={16} weight="light" aria-hidden="true" />
        </button>
      </div>

      <article className="audio-stage__content">
          <div className="audio-stage__art">
            <img src={session.image} alt={session.alt} width="1254" height="1254" loading="lazy" />
            <button className="audio-stage__play" type="button" onClick={togglePlayback} aria-label={`${playing ? 'Pause' : 'Play'} ${session.title}`}>
              {playing ? <PauseIcon size={24} weight="fill" /> : <PlayIcon size={24} weight="fill" />}
            </button>
          </div>

          <div className="audio-stage__details">
            <div className="audio-stage__status">
              <WaveformIcon size={19} weight="light" aria-hidden="true" />
              <span aria-live="polite">{notice}</span>
            </div>
            <h3>{session.title}</h3>

            <div className="audio-stage__meta">
              <span><MicrophoneStageIcon size={18} weight="light" aria-hidden="true" /> Speaker: {session.host}</span>
              <span><UsersThreeIcon size={18} weight="light" aria-hidden="true" /> {session.listeners.length + 1} in the room</span>
            </div>

            <div className="audio-stage__progress">
              <div className="audio-stage__progress-copy">
                <span>Clip position</span>
                <span>{session.duration}</span>
              </div>
              <div className="audio-stage__track" role="progressbar" aria-label="Clip progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <i style={{ '--clip-progress': Math.max(0, Math.min(1, progress / 100)) } as CSSProperties} />
              </div>
            </div>

            <div className="audio-stage__listeners" aria-label="People in this clip">
              {session.listeners.map((listener) => (
                <span key={listener} title={listener}>{listener.slice(0, 2).toUpperCase()}</span>
              ))}
              <small>{session.listeners.join(', ')}</small>
            </div>

            <audio
              ref={audioRef}
              src={session.audioSrc}
              preload="metadata"
              onTimeUpdate={(event) => {
                const audio = event.currentTarget
                if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
              }}
              onEnded={() => {
                setPlaying(false)
                setNotice('Clip finished')
                setProgress(100)
              }}
            >
              <track kind="captions" />
            </audio>
          </div>
      </article>
    </div>
  )
}
