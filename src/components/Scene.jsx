import { useState, useCallback, useRef } from 'react'
import ParticleSystem from './ParticleSystem'
import AnimatedText from './AnimatedText'

export default function Scene() {
  const [textBounds, setTextBounds] = useState(null)
  const [started, setStarted] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(1)
  const [burstTrigger, setBurstTrigger] = useState(null)
  const [cursorPos, setCursorPos] = useState(null)
  const audioRef = useRef(null)

  const handleBoundsChange = useCallback((bounds) => {
    setTextBounds(bounds)
  }, [])

  const handlePhaseChange = useCallback((phase) => {
    setBurstTrigger(phase)
  }, [])

  const handleCursorMove = useCallback((pos) => {
    setCursorPos(pos)
  }, [])

  const handleStart = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`${import.meta.env.BASE_URL}assets/audio/audio.mp3`)
      audioRef.current.preload = 'auto'
    }

    audioRef.current.play().then(() => {
      setStarted(true)
      setOverlayOpacity(0)
    }).catch((err) => {
      console.warn('Audio playback failed:', err)
      setStarted(true)
      setOverlayOpacity(0)
    })
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Subtle radial gradient overlay for depth */}
      <div
        className="fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(20,20,30,0.4) 0%, rgba(0,0,0,0) 70%)',
          zIndex: 0,
        }}
      />

      {started && (
        <>
          <ParticleSystem textBounds={textBounds} burstTrigger={burstTrigger} cursorPos={cursorPos} />
          <AnimatedText
            onBoundsChange={handleBoundsChange}
            audioRef={audioRef}
            onPhaseChange={handlePhaseChange}
            onCursorMove={handleCursorMove}
          />
        </>
      )}

      {/* Vignette overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
          zIndex: 3,
        }}
      />

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
          onTransitionEnd={() => {
            if (overlayOpacity === 0) {
              // fully hidden — no cleanup needed, React handles it
            }
          }}
        >
          <div className="relative">
            {/* Pulsing ring */}
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
            {/* Play button */}
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
              {/* Triangle play icon */}
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

      {/* Keyframe for pulsing ring */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
