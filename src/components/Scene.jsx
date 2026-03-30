import { useState, useCallback, useRef, useEffect } from 'react'
import ParticleSystem from './ParticleSystem'
import AnimatedText from './AnimatedText'
import { getTimelineState } from '../timeline'

const MAX_LOOPS = 2

export default function Scene() {
  const [textBounds, setTextBounds] = useState(null)
  const [started, setStarted] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(1)
  const [cursorPos, setCursorPos] = useState(null)
  const [timelineState, setTimelineState] = useState(null)

  const audioRef = useRef(null)
  const startTimeRef = useRef(0)
  const loopCountRef = useRef(0)
  const rafRef = useRef(null)

  const handleBoundsChange = useCallback((bounds) => setTextBounds(bounds), [])
  const handleCursorMove = useCallback((pos) => setCursorPos(pos), [])

  // Master animation loop — drives everything
  useEffect(() => {
    if (!started) return
    let active = true

    function tick() {
      if (!active) return
      const elapsed = Date.now() - startTimeRef.current
      const state = getTimelineState(elapsed)
      setTimelineState(state)

      // When timeline completes, check for loop
      if (state.isComplete) {
        loopCountRef.current++
        if (loopCountRef.current < MAX_LOOPS) {
          // Restart timeline + audio
          startTimeRef.current = Date.now()
          if (audioRef.current) {
            audioRef.current.currentTime = 0
            audioRef.current.play().catch(() => {})
          }
        } else {
          // Done — fade out audio
          if (audioRef.current) {
            fadeOutAudio(audioRef.current, 1500)
          }
          return // stop the loop
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { active = false; cancelAnimationFrame(rafRef.current) }
  }, [started])

  const handleStart = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`${import.meta.env.BASE_URL}assets/audio/audio.mp3`)
      audioRef.current.preload = 'auto'
      audioRef.current.volume = 0
      audioRef.current.loop = true // loop audio continuously while timeline runs
    }

    startTimeRef.current = Date.now()
    loopCountRef.current = 0

    audioRef.current.play().then(() => {
      fadeInAudio(audioRef.current, 800)
      setStarted(true)
      setOverlayOpacity(0)
    }).catch(() => {
      // Still start without audio
      setStarted(true)
      setOverlayOpacity(0)
    })
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Slow cinematic zoom */}
      <div
        className="fixed inset-0"
        style={{
          animation: started ? 'cinematic-zoom 25s ease-in-out infinite alternate' : 'none',
          transformOrigin: 'center center',
        }}
      >
        {/* Depth gradient */}
        <div
          className="fixed inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(20,20,40,0.5) 0%, rgba(0,0,0,0) 60%)',
            zIndex: 0,
          }}
        />

        {started && timelineState && (
          <>
            <ParticleSystem
              timelineState={timelineState}
              textBounds={textBounds}
              cursorPos={cursorPos}
            />
            <AnimatedText
              timelineState={timelineState}
              onBoundsChange={handleBoundsChange}
              onCursorMove={handleCursorMove}
            />
          </>
        )}
      </div>

      {/* Letterbox bars */}
      {started && (
        <>
          <div
            className="fixed left-0 right-0 top-0 pointer-events-none"
            style={{
              height: '6vh',
              background: 'linear-gradient(to bottom, #000 60%, transparent)',
              zIndex: 4,
              animation: 'letterbox-in 2s ease-out forwards',
            }}
          />
          <div
            className="fixed left-0 right-0 bottom-0 pointer-events-none"
            style={{
              height: '6vh',
              background: 'linear-gradient(to top, #000 60%, transparent)',
              zIndex: 4,
              animation: 'letterbox-in 2s ease-out forwards',
            }}
          />
        </>
      )}

      {/* Scanlines */}
      {started && (
        <div
          className="fixed inset-0 pointer-events-none scanlines"
          style={{ zIndex: 5, opacity: 0.04 }}
        />
      )}

      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%),
            radial-gradient(ellipse at 20% 50%, rgba(0,255,159,0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 50%, rgba(0,200,255,0.03) 0%, transparent 50%)
          `,
          zIndex: 3,
        }}
      />

      {/* Ambient flare */}
      {started && (
        <div
          className="fixed pointer-events-none"
          style={{
            width: '40vw',
            height: '40vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,255,159,0.06) 0%, rgba(0,200,255,0.03) 30%, transparent 70%)',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'flare-drift 12s ease-in-out infinite alternate',
            filter: 'blur(40px)',
            zIndex: 1,
          }}
        />
      )}

      {/* Start Experience overlay */}
      {overlayOpacity > 0 && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none"
          style={{
            zIndex: 10,
            opacity: overlayOpacity,
            transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: started ? 'none' : 'auto',
          }}
          onClick={!started ? handleStart : undefined}
        >
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full border border-white/20"
              style={{
                width: 80,
                height: 80,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: 'pulse-ring 2s ease-in-out infinite',
              }}
            />
            <div
              className="flex items-center justify-center rounded-full border border-white/30 backdrop-blur-sm"
              style={{
                width: 72,
                height: 72,
                background: 'rgba(255,255,255,0.05)',
                transition: 'background 0.3s, border-color 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
              }}
            >
              <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                <path d="M4 2L22 14L4 26V2Z" fill="white" fillOpacity="0.8" />
              </svg>
            </div>
          </div>
          <p
            className="mt-8 text-white/50 text-sm tracking-[0.2em] uppercase font-light"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Start Experience
          </p>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
        }
        @keyframes cinematic-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.03); }
        }
        @keyframes letterbox-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes flare-drift {
          0% { transform: translate(-60%, -40%); opacity: 0.6; }
          50% { transform: translate(-40%, -55%); opacity: 1; }
          100% { transform: translate(-50%, -45%); opacity: 0.7; }
        }
        .scanlines {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.03) 2px,
            rgba(255,255,255,0.03) 4px
          );
        }
      `}</style>
    </div>
  )
}

// Audio fade helpers
function fadeInAudio(audio, duration) {
  const start = Date.now()
  const target = 1.0
  function step() {
    const elapsed = Date.now() - start
    const progress = Math.min(elapsed / duration, 1)
    audio.volume = progress * target
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function fadeOutAudio(audio, duration) {
  const start = Date.now()
  const initial = audio.volume
  function step() {
    const elapsed = Date.now() - start
    const progress = Math.min(elapsed / duration, 1)
    audio.volume = Math.max(0, initial * (1 - progress))
    if (progress < 1) requestAnimationFrame(step)
    else audio.pause()
  }
  requestAnimationFrame(step)
}
