import { useRef, useEffect, useCallback } from 'react'

/**
 * PARTICLE SYSTEM — Trailblazer particles that follow text reveal cursor
 *
 * Particles spawn near the currently revealing character and drift right
 * with sine-wave sway, creating a visible trail behind the text cursor.
 * On phase change: burst outward from text center.
 *
 * Tweakable:
 * - PARTICLE_COUNT    — max on screen
 * - TRAIL_SPAWN_RATE  — particles spawned per frame at cursor
 * - TRAIL_LIFE        — how long trail particles live (frames)
 * - TRAIL_SPEED       — forward (left→right) drift speed
 * - SWAY_AMP          — vertical sine wave amplitude
 * - COLORS            — neon palette
 * - SIZE_RANGE        — square pixel size
 * - BURST_COUNT       — particles spawned on phase change
 */

const COLORS = [
  '#00ff9f', // green
  '#00ffff', // cyan
  '#ff3b3b', // red
  '#facc15', // yellow
  '#f472b6', // pink
  '#a78bfa', // purple
  '#fb923c', // orange
  '#22d3ee', // sky cyan
  '#e879f9', // fuchsia
  '#4ade80', // lime
  '#38bdf8', // light blue
  '#fbbf24', // amber
  '#f87171', // coral
  '#2dd4bf', // teal
  '#c084fc', // violet
]

const PARTICLE_COUNT = 450
const TRAIL_SPAWN_RATE = 8    // particles per frame at cursor
const TRAIL_LIFE = [25, 50]   // frames — longer life = visible trail behind head
const TRAIL_SPEED = [0.8, 3.5] // forward drift px/frame
const SWAY_AMP = [1.5, 5.0]   // sine wave vertical amplitude
const SIZE_RANGE = [2, 6]
const BURST_COUNT = 100
const GLOW_BLUR = 6

function rand(a, b) { return Math.random() * (b - a) + a }

function createTrailParticle(cx, cy) {
  return {
    x: cx + (Math.random() - 0.5) * 20,
    y: cy + (Math.random() - 0.5) * 80,
    vx: rand(TRAIL_SPEED[0], TRAIL_SPEED[1]),
    vy: 0,
    size: rand(SIZE_RANGE[0], SIZE_RANGE[1]),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: rand(0.6, 1.0),
    life: Math.floor(rand(TRAIL_LIFE[0], TRAIL_LIFE[1])),
    maxLife: 0,
    swayPhase: Math.random() * Math.PI * 2,
    swayFreq: rand(0.08, 0.18),
    swayAmp: rand(SWAY_AMP[0], SWAY_AMP[1]),
    type: 'trail',
  }
}

function createBurstParticle(cx, cy) {
  const angle = Math.random() * Math.PI * 2
  const speed = rand(2, 8)
  return {
    x: cx + (Math.random() - 0.5) * 40,
    y: cy + (Math.random() - 0.5) * 20,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.5, // flatter burst
    size: rand(2, 5),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: rand(0.7, 1),
    targetOpacity: 1,
    life: Math.floor(rand(30, 90)),
    fadeIn: false,
    wobblePhase: 0,
    wobbleFreq: 0,
    wobbleAmp: 0,
    type: 'burst',
  }
}

export default function ParticleSystem({ textBounds, burstTrigger, cursorPos }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)
  const frameRef = useRef(0)
  const lastBurstRef = useRef(-1)
  const cursorRef = useRef(null) // latest cursor position

  // Keep cursorPos in a ref so the animation loop always reads the latest
  useEffect(() => {
    cursorRef.current = cursorPos
  }, [cursorPos])

  // Spawn burst particles when burstTrigger changes
  useEffect(() => {
    if (burstTrigger == null || burstTrigger === lastBurstRef.current) return
    lastBurstRef.current = burstTrigger

    const cx = textBounds?.x ?? window.innerWidth / 2
    const cy = textBounds?.y ?? window.innerHeight / 2
    const particles = particlesRef.current
    for (let i = 0; i < BURST_COUNT; i++) {
      particles.push(createBurstParticle(cx, cy))
    }
  }, [burstTrigger, textBounds])

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

    // No initial seeding — particles spawn at cursor during reveal

    function animate() {
      frameRef.current++
      const t = frameRef.current
      const particles = particlesRef.current
      ctx.clearRect(0, 0, w, h)

      const cursor = cursorRef.current

      // Spawn trail particles at cursor position (only while text is revealing)
      if (cursor && particles.length < PARTICLE_COUNT) {
        for (let s = 0; s < TRAIL_SPAWN_RATE; s++) {
          const p = createTrailParticle(cursor.x, cursor.y)
          p.maxLife = p.life
          particles.push(p)
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // Life & fade out
        p.life--
        const lifeFraction = p.maxLife > 0 ? p.life / p.maxLife : 0
        if (p.type === 'trail') {
          // Smooth fade: full opacity → 0 over lifetime
          p.opacity = lifeFraction * (p.opacity > 0 ? 1 : 0.8)
        }
        if (p.life <= 0 || p.opacity < 0.008) {
          particles.splice(i, 1)
          continue
        }

        if (p.type === 'trail') {
          // Forward drift (left → right)
          p.x += p.vx
          // Sine wave sway
          p.vy = Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp
          p.y += p.vy
        } else {
          // Burst: decelerate outward
          p.vx *= 0.96
          p.vy *= 0.96
          p.x += p.vx
          p.y += p.vy
          if (p.life < 30) p.opacity *= 0.92
        }

        // Remove off-screen
        if (p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
          particles.splice(i, 1)
          continue
        }

        // Draw
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.shadowColor = p.color
        ctx.shadowBlur = GLOW_BLUR
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
  }, [textBounds])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 1 }}
    />
  )
}
