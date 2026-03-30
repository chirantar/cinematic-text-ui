import { useRef, useEffect } from 'react'

/**
 * PARTICLE SYSTEM — Timeline-driven.
 * Receives: timelineState, textBounds, cursorPos
 * particleIntensity from timeline controls spawn rate + density.
 */

const COLORS = [
  '#00ff9f', '#00ffff', '#ff3b3b', '#facc15', '#f472b6',
  '#a78bfa', '#fb923c', '#22d3ee', '#e879f9', '#4ade80',
  '#38bdf8', '#fbbf24', '#f87171', '#2dd4bf', '#c084fc',
]

const MAX_PARTICLES = 600
const BASE_SPAWN_RATE = 10
const TRAIL_LIFE = [25, 55]
const TRAIL_SPEED = [0.6, 3.8]
const SWAY_AMP = [1.5, 5.5]
const SIZE_RANGE = [1.5, 6]
const BURST_COUNT = 120
const GLOW_BLUR = 7

function rand(a, b) { return Math.random() * (b - a) + a }

function createTrailParticle(cx, cy, intensity) {
  const spreadY = 40 + intensity * 60
  return {
    x: cx + (Math.random() - 0.5) * 18,
    y: cy + (Math.random() - 0.5) * spreadY,
    vx: rand(TRAIL_SPEED[0], TRAIL_SPEED[1]) * (0.6 + intensity * 0.4),
    vy: 0,
    size: rand(SIZE_RANGE[0], SIZE_RANGE[1]) * (0.7 + intensity * 0.3),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: rand(0.5, 1.0),
    life: Math.floor(rand(TRAIL_LIFE[0], TRAIL_LIFE[1])),
    maxLife: 0,
    swayPhase: Math.random() * Math.PI * 2,
    swayFreq: rand(0.07, 0.2),
    swayAmp: rand(SWAY_AMP[0], SWAY_AMP[1]),
    type: 'trail',
  }
}

function createBurstParticle(cx, cy) {
  const angle = Math.random() * Math.PI * 2
  const speed = rand(2.5, 9)
  return {
    x: cx + (Math.random() - 0.5) * 40,
    y: cy + (Math.random() - 0.5) * 20,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.5,
    size: rand(2, 5),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: rand(0.7, 1),
    life: Math.floor(rand(35, 100)),
    maxLife: 0,
    swayPhase: 0,
    swayFreq: 0,
    swayAmp: 0,
    type: 'burst',
  }
}

// Ambient drift particles for hold/pause phases
function createAmbientParticle(w, h, intensity) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.3,
    size: rand(1, 3),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: rand(0.1, 0.3) * intensity,
    life: Math.floor(rand(60, 150)),
    maxLife: 0,
    swayPhase: Math.random() * Math.PI * 2,
    swayFreq: rand(0.02, 0.06),
    swayAmp: rand(0.3, 1.2),
    type: 'ambient',
  }
}

export default function ParticleSystem({ timelineState, textBounds, cursorPos }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)
  const frameRef = useRef(0)
  const lastPhaseRef = useRef(-1)
  const cursorRef = useRef(null)
  const stateRef = useRef(null)

  useEffect(() => { cursorRef.current = cursorPos }, [cursorPos])
  useEffect(() => { stateRef.current = timelineState }, [timelineState])

  // Burst on phase change
  useEffect(() => {
    const pi = timelineState?.phaseIndex ?? -1
    if (pi >= 0 && pi !== lastPhaseRef.current) {
      lastPhaseRef.current = pi
      const cx = textBounds?.x ?? window.innerWidth / 2
      const cy = textBounds?.y ?? window.innerHeight / 2
      const particles = particlesRef.current
      const count = pi === 2 ? BURST_COUNT * 1.5 : BURST_COUNT // bigger burst on final phase
      for (let i = 0; i < count; i++) {
        const p = createBurstParticle(cx, cy)
        p.maxLife = p.life
        particles.push(p)
      }
    }
  }, [timelineState?.phaseIndex, textBounds])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let w, h

    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function animate() {
      frameRef.current++
      const t = frameRef.current
      const particles = particlesRef.current
      ctx.clearRect(0, 0, w, h)

      const state = stateRef.current
      const cursor = cursorRef.current
      const intensity = state?.particleIntensity ?? 0

      // Dynamic spawn rate based on timeline intensity
      const spawnRate = Math.floor(BASE_SPAWN_RATE * intensity)

      // Spawn trail particles at cursor during reveal
      if (cursor && state?.inReveal && particles.length < MAX_PARTICLES) {
        for (let s = 0; s < spawnRate; s++) {
          const p = createTrailParticle(cursor.x, cursor.y, intensity)
          p.maxLife = p.life
          particles.push(p)
        }
      }

      // Ambient particles during pause/hold/settle
      if (!state?.inReveal && intensity > 0.05 && particles.length < MAX_PARTICLES * 0.3) {
        if (Math.random() < intensity * 0.3) {
          const p = createAmbientParticle(w, h, intensity)
          p.maxLife = p.life
          particles.push(p)
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life--
        const lifeFrac = p.maxLife > 0 ? p.life / p.maxLife : 0

        if (p.life <= 0 || p.opacity < 0.005) {
          particles.splice(i, 1)
          continue
        }

        if (p.type === 'trail') {
          p.opacity = lifeFrac * 0.9
          p.x += p.vx
          p.vy = Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp
          p.y += p.vy
        } else if (p.type === 'burst') {
          p.vx *= 0.955
          p.vy *= 0.955
          p.x += p.vx
          p.y += p.vy
          if (p.life < 35) p.opacity *= 0.91
        } else if (p.type === 'ambient') {
          p.opacity = lifeFrac * 0.25
          p.x += p.vx + Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp * 0.3
          p.y += p.vy
        }

        // Off-screen removal
        if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) {
          particles.splice(i, 1)
          continue
        }

        // Draw with glow
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.shadowColor = p.color
        ctx.shadowBlur = GLOW_BLUR + (p.type === 'burst' ? 4 : 0)
        ctx.fillStyle = p.color
        ctx.fillRect(
          Math.round(p.x - p.size / 2),
          Math.round(p.y - p.size / 2),
          p.size, p.size
        )
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 1 }}
    />
  )
}
