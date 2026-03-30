import { useState, useEffect, useRef, useCallback } from 'react'

const PHASES = [
  { time: 0,   text: 'I have a dream' },
  { time: 1.5, text: "I have a dream and don't know where to start" },
  { time: 3,   text: 'I want to open a furniture-coffee shop in Austin.' },
]

const CHAR_REVEAL_SPEED = 45
const FADE_DURATION = 600
const GLITCH_BURST_DURATION = 800 // ms of heavy glitch on phase change

export default function AnimatedText({ onBoundsChange, audioRef, onPhaseChange, onCursorMove }) {
  const [phase, setPhase] = useState(-1)
  const [displayText, setDisplayText] = useState('')
  const [revealIndex, setRevealIndex] = useState(0) // how many chars fully revealed (100%)
  const [opacity, setOpacity] = useState(0)
  const containerRef = useRef(null)
  const baseTextRef = useRef(null) // ref on the base white text span for measuring width
  const timerRef = useRef(null)
  const prevPhaseRef = useRef(-1)
  const targetTextRef = useRef('')
  const revealProgressRef = useRef(0) // 0→1 continuous progress

  // Glitch animation state
  const [glitch, setGlitch] = useState({ rx: 0, gx: 0, cy: 0, o1: 0, o2: 0, skew: 0, barY: 50 })
  const glitchRafRef = useRef(null)
  const glitchIntensityRef = useRef(0)
  const burstTimeRef = useRef(0)

  const reportBounds = useCallback(() => {
    if (containerRef.current && onBoundsChange) {
      const rect = containerRef.current.getBoundingClientRect()
      onBoundsChange({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      })
    }
  }, [onBoundsChange])

  // --- Glitch animation loop (rAF) ---
  useEffect(() => {
    let active = true
    function loop() {
      if (!active) return
      const elapsed = Date.now() - burstTimeRef.current
      // Intensity: decays from 1→0 over burst duration, then stays at idle level
      const burstT = Math.max(0, 1 - elapsed / GLITCH_BURST_DURATION)
      glitchIntensityRef.current = 0.06 + burstT * 0.94 // 0.06 idle, 1.0 peak

      const I = glitchIntensityRef.current
      const fire = Math.random() < (0.08 + I * 0.55)

      if (fire) {
        const maxX = 2 + I * 14
        setGlitch({
          rx: (Math.random() - 0.5) * maxX,
          gx: (Math.random() - 0.5) * maxX,
          cy: (Math.random() - 0.5) * maxX * 0.4,
          o1: 0.12 + I * 0.65,
          o2: 0.10 + I * 0.55,
          skew: (Math.random() - 0.5) * I * 4,
          barY: Math.random() * 100,
        })
      } else {
        setGlitch(prev => ({
          rx: prev.rx * 0.75,
          gx: prev.gx * 0.75,
          cy: prev.cy * 0.75,
          o1: prev.o1 * 0.88,
          o2: prev.o2 * 0.88,
          skew: prev.skew * 0.8,
          barY: prev.barY,
        }))
      }
      glitchRafRef.current = requestAnimationFrame(loop)
    }
    glitchRafRef.current = requestAnimationFrame(loop)
    return () => { active = false; cancelAnimationFrame(glitchRafRef.current) }
  }, [])

  // --- Audio sync ---
  useEffect(() => {
    const audio = audioRef?.current
    if (!audio) return
    const id = setInterval(() => {
      const t = audio.currentTime
      let next = -1
      for (let i = PHASES.length - 1; i >= 0; i--) {
        if (t >= PHASES[i].time) { next = i; break }
      }
      if (next !== prevPhaseRef.current && next >= 0) {
        prevPhaseRef.current = next
        setPhase(next)
        burstTimeRef.current = Date.now() // trigger glitch burst
        onPhaseChange?.(next)
      }
    }, 50)
    return () => clearInterval(id)
  }, [audioRef, onPhaseChange])

  // --- Typewriter reveal ---
  useEffect(() => {
    if (phase < 0) return
    const target = PHASES[phase].text
    clearInterval(timerRef.current)

    setOpacity(0)
    const fadeIn = setTimeout(() => setOpacity(1), 50)

    const prev = phase > 0 ? PHASES[phase - 1].text : ''
    let prefix = ''
    for (let i = 0; i < Math.min(prev.length, target.length); i++) {
      if (prev[i] === target[i]) prefix += target[i]; else break
    }
    let idx = prefix.length
    setDisplayText(prefix)
    setRevealIndex(Math.max(0, prefix.length - 2))
    targetTextRef.current = target
    revealProgressRef.current = target.length > 0 ? prefix.length / target.length : 0

    timerRef.current = setInterval(() => {
      idx++
      if (idx <= target.length) {
        setDisplayText(target.slice(0, idx))
        setRevealIndex(Math.max(0, idx - 2))
        revealProgressRef.current = idx / target.length
        reportBounds()
      } else {
        setRevealIndex(target.length)
        revealProgressRef.current = 1
        clearInterval(timerRef.current)
      }
    }, CHAR_REVEAL_SPEED)

    return () => { clearInterval(timerRef.current); clearTimeout(fadeIn) }
  }, [phase, reportBounds])

  // Report bounds AND compute continuous headX for particle trailblazer
  useEffect(() => {
    reportBounds()
    if (baseTextRef.current && onCursorMove) {
      const rect = baseTextRef.current.getBoundingClientRect()
      const textStartX = rect.left
      const textWidth = rect.width
      const progress = revealProgressRef.current
      const headX = textStartX + textWidth * progress
      const baselineY = rect.top + rect.height / 2
      onCursorMove(progress < 1 ? { x: headX, y: baselineY } : null)
    }
  }, [displayText, reportBounds, onCursorMove])

  // Cursor blink
  const [showCursor, setShowCursor] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setShowCursor(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  const isFinal = phase === PHASES.length - 1
  const isRevealed = phase >= 0 && displayText === PHASES[phase].text
  const I = glitchIntensityRef.current

  const textStyle = {
    fontSize: 'clamp(32px, 5vw, 72px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    fontWeight: 300,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
      <div
        ref={containerRef}
        className="max-w-[90vw] text-center px-8 relative"
        style={{ opacity, transition: `opacity ${FADE_DURATION}ms cubic-bezier(0.4,0,0.2,1)` }}
      >
        {/* ---- Glitch layer: RED ---- */}
        <span
          className="absolute inset-0 select-none pointer-events-none"
          aria-hidden="true"
          style={{
            ...textStyle,
            color: '#ff3b3b',
            transform: `translateX(${glitch.rx}px) skewX(${glitch.skew}deg)`,
            opacity: glitch.o1,
            mixBlendMode: 'screen',
            willChange: 'transform, opacity',
          }}
        >{displayText}</span>

        {/* ---- Glitch layer: CYAN ---- */}
        <span
          className="absolute inset-0 select-none pointer-events-none"
          aria-hidden="true"
          style={{
            ...textStyle,
            color: '#00ffff',
            transform: `translateX(${glitch.gx}px) translateY(${glitch.cy}px) skewX(${-glitch.skew * 0.5}deg)`,
            opacity: glitch.o2,
            mixBlendMode: 'screen',
            willChange: 'transform, opacity',
          }}
        >{displayText}</span>

        {/* ---- Base layer: WHITE with per-char dual-pass opacity ---- */}
        <span
          ref={baseTextRef}
          className="relative"
          style={{
            ...textStyle,
            color: '#fff',
            textShadow: `0 0 20px rgba(255,255,255,0.15), 0 0 60px rgba(0,255,159,${0.04 + I * 0.12})`,
          }}
        >
          {displayText.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                opacity: i < revealIndex ? 1 : 0.5,
                transition: 'opacity 0.15s ease-out',
              }}
            >{ch}</span>
          ))}
          <span
            className="inline-block w-[3px] ml-1 bg-white align-middle"
            style={{
              height: 'clamp(28px, 4.5vw, 64px)',
              opacity: (isRevealed && isFinal) ? 0 : showCursor ? 0.8 : 0,
              transition: 'opacity 0.1s',
              verticalAlign: 'text-bottom',
              boxShadow: '0 0 8px rgba(0,255,159,0.5)',
            }}
          />
        </span>

        {/* ---- Scanline glitch bar ---- */}
        {I > 0.25 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: `${glitch.barY}%`,
              height: `${2 + I * 5}px`,
              background: `linear-gradient(90deg, transparent 5%, rgba(0,255,159,${I * 0.4}) 30%, rgba(255,59,59,${I * 0.3}) 70%, transparent 95%)`,
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>
    </div>
  )
}
