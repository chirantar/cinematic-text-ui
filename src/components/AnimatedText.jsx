import { useState, useEffect, useRef, useCallback } from 'react'

const GLITCH_BURST_DURATION = 800

/**
 * AnimatedText — Driven by timeline state from parent.
 * No internal timers or audio polling.
 * Receives: timelineState, onBoundsChange, onCursorMove
 */
export default function AnimatedText({ timelineState, onBoundsChange, onCursorMove }) {
  const containerRef = useRef(null)
  const baseTextRef = useRef(null)
  const glitchRafRef = useRef(null)
  const lastPhaseRef = useRef(-1)
  const burstTimeRef = useRef(0)

  // Glitch animation state (driven by rAF for smooth flicker)
  const [glitch, setGlitch] = useState({ rx: 0, gx: 0, cy: 0, o1: 0, o2: 0, skew: 0, barY: 50 })
  const glitchTargetRef = useRef(0)

  const {
    phaseIndex = -1,
    phaseProgress = 0,
    displayText = '',
    glitchIntensity = 0,
    inPause = false,
    inReveal = false,
    inSettle = false,
    isFinalPhase = false,
    overallProgress = 0,
  } = timelineState || {}

  // Detect phase change → trigger glitch burst
  useEffect(() => {
    if (phaseIndex >= 0 && phaseIndex !== lastPhaseRef.current) {
      lastPhaseRef.current = phaseIndex
      burstTimeRef.current = Date.now()
    }
  }, [phaseIndex])

  // Update glitch target intensity from timeline
  useEffect(() => {
    glitchTargetRef.current = glitchIntensity
  }, [glitchIntensity])

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

  // Glitch animation loop
  useEffect(() => {
    let active = true
    function loop() {
      if (!active) return
      const elapsed = Date.now() - burstTimeRef.current
      const burstT = Math.max(0, 1 - elapsed / GLITCH_BURST_DURATION)
      const baseI = glitchTargetRef.current
      const I = Math.min(1, baseI + burstT * 0.6)

      const fire = Math.random() < (0.06 + I * 0.5)
      if (fire) {
        const maxX = 1.5 + I * 12
        setGlitch({
          rx: (Math.random() - 0.5) * maxX,
          gx: (Math.random() - 0.5) * maxX,
          cy: (Math.random() - 0.5) * maxX * 0.35,
          o1: 0.08 + I * 0.6,
          o2: 0.06 + I * 0.5,
          skew: (Math.random() - 0.5) * I * 3.5,
          barY: Math.random() * 100,
        })
      } else {
        setGlitch(prev => ({
          rx: prev.rx * 0.72,
          gx: prev.gx * 0.72,
          cy: prev.cy * 0.72,
          o1: prev.o1 * 0.85,
          o2: prev.o2 * 0.85,
          skew: prev.skew * 0.78,
          barY: prev.barY,
        }))
      }
      glitchRafRef.current = requestAnimationFrame(loop)
    }
    glitchRafRef.current = requestAnimationFrame(loop)
    return () => { active = false; cancelAnimationFrame(glitchRafRef.current) }
  }, [])

  // Report bounds + cursor position
  useEffect(() => {
    reportBounds()
    if (baseTextRef.current && onCursorMove && inReveal) {
      const rect = baseTextRef.current.getBoundingClientRect()
      const headX = rect.left + rect.width
      const baselineY = rect.top + rect.height / 2
      onCursorMove({ x: headX, y: baselineY })
    } else if (!inReveal) {
      onCursorMove?.(null)
    }
  }, [displayText, phaseProgress, inReveal, reportBounds, onCursorMove])

  // Cursor blink
  const [showCursor, setShowCursor] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setShowCursor(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  const isRevealed = phaseProgress >= 1
  const curI = glitchTargetRef.current

  // Compute reveal index for dual-pass opacity (last 3 chars at 50%)
  const revealIndex = Math.max(0, displayText.length - 3)

  // Opacity: fade in from 0 on first phase, stay at 1 after
  const textOpacity = phaseIndex < 0 ? 0 : inPause ? 0.4 + overallProgress * 0.6 : 1

  // Scale: subtle breathe — slightly larger on final phase
  const scale = 1 + (isFinalPhase && isRevealed ? 0.008 : 0)

  // Glow intensity increases with overall progress
  const glowAlpha = 0.04 + overallProgress * 0.15

  const textStyle = {
    fontSize: 'clamp(32px, 5vw, 72px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    fontWeight: 300,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }

  if (phaseIndex < 0) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
      <div
        ref={containerRef}
        className="max-w-[85vw] text-center px-8 relative"
        style={{
          opacity: textOpacity,
          transform: `scale(${scale})`,
          transition: 'opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 1.2s cubic-bezier(0.4,0,0.2,1)',
        }}
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
            textShadow: `0 0 30px rgba(255,255,255,${glowAlpha}), 0 0 80px rgba(0,255,159,${glowAlpha * 0.8})`,
          }}
        >
          {displayText.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                opacity: i < revealIndex ? 1 : 0.45,
                transition: 'opacity 0.2s ease-out',
              }}
            >{ch}</span>
          ))}
          <span
            className="inline-block w-[3px] ml-1 bg-white align-middle"
            style={{
              height: 'clamp(28px, 4.5vw, 64px)',
              opacity: inReveal && showCursor ? 0.8 : (isRevealed && isFinalPhase) ? 0 : showCursor ? 0.4 : 0,
              transition: 'opacity 0.15s',
              verticalAlign: 'text-bottom',
              boxShadow: `0 0 ${8 + curI * 15}px rgba(0,255,159,${0.4 + curI * 0.4})`,
            }}
          />
        </span>

        {/* ---- Scanline glitch bar ---- */}
        {curI > 0.2 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: `${glitch.barY}%`,
              height: `${1.5 + curI * 4}px`,
              background: `linear-gradient(90deg, transparent 5%, rgba(0,255,159,${curI * 0.35}) 30%, rgba(255,59,59,${curI * 0.25}) 70%, transparent 95%)`,
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>
    </div>
  )
}
