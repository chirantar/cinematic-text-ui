import { useRef, useEffect, useCallback } from 'react'

/**
 * PARTICLE SYSTEM — Text-aligned horizontal flow + glitch bursts
 *
 * Particles:
 * - Spawn from left/right edges at the TEXT Y-level (not random background)
 * - Flow horizontally THROUGH the text band
 * - Cluster toward text center, then disperse
 * - On phase change: burst outward from text center
 *
 * Tweakable:
 * - PARTICLE_COUNT    — max on screen
 * - STREAM_BAND       — vertical thickness of the particle stream (px from center)
 * - COLORS            — neon palette
 * - SIZE_RANGE        — square pixel size
 * - FLOW_SPEED        — horizontal drift speed range
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
]

const PARTICLE_COUNT = 200
const STREAM_BAND = 60       // ±px from text center Y
const SIZE_RANGE = [2, 6]
const FLOW_SPEED = [0.8, 3.0]
const BURST_COUNT = 80
const GLOW_BLUR = 6

function rand(a, b) { return Math.random() * (b - a) + a }

function createStreamParticle(w, h, textY, fromLeft) {
  const dir = fromLeft ? 1 : -1
  return {
    x: fromLeft ? -rand(5, 40) : w + rand(5, 40),
    y: textY + (Math.random() - 0.5) * STREAM_BAND * 2,
    vx: dir * rand(FLOW_SPEED[0], FLOW_SPEED[1]),
    vy: (Math.random() - 0.5) * 0.4,
    size: rand(SIZE_RANGE[0], SIZE_RANGE[1]),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: 0,
    targetOpacity: rand(0.4, 0.95),
    life: Math.floor(rand(100, 300)),
    fadeIn: true,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleFreq: rand(0.015, 0.05),
    wobbleAmp: rand(0.3, 1.2),
    type: 'stream',
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

export default function ParticleSystem({ textBounds, burstTrigger }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)
  const frameRef = useRef(0)
  const lastBurstRef = useRef(-1)

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

    // Seed initial stream particles
    const textY = textBounds?.y ?? h / 2
    for (let i = 0; i < PARTICLE_COUNT * 0.5; i++) {
      const p = createStreamParticle(w, h, textY, Math.random() > 0.5)
      p.x = rand(0, w) // scatter across width
      p.opacity = p.targetOpacity * rand(0.3, 0.8)
      p.fadeIn = false
      particlesRef.current.push(p)
    }

    function animate() {
      frameRef.current++
      const t = frameRef.current
      const particles = particlesRef.current
      ctx.clearRect(0, 0, w, h)

      const cx = textBounds?.x ?? w / 2
      const cy = textBounds?.y ?? h / 2

      // Spawn new stream particles from edges (2 per frame)
      if (particles.length < PARTICLE_COUNT) {
        for (let s = 0; s < 2; s++) {
          particles.push(createStreamParticle(w, h, cy, Math.random() > 0.5))
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // Fade in
        if (p.fadeIn) {
          p.opacity += 0.03
          if (p.opacity >= p.targetOpacity) {
            p.opacity = p.targetOpacity
            p.fadeIn = false
          }
        }

        // Life & fade out
        p.life--
        if (p.life < 30) p.opacity *= 0.94
        if (p.life <= 0 || p.opacity < 0.008) {
          particles.splice(i, 1)
          continue
        }

        if (p.type === 'stream') {
          // Gentle attraction toward text Y-center (keeps stream cohesive)
          const dy = cy - p.y
          p.vy += dy * 0.002

          // Near the text X-center, slow down briefly (cluster effect)
          const dx = cx - p.x
          const distX = Math.abs(dx)
          if (distX < 120) {
            p.vx *= 0.995 // slight drag near text
            p.opacity = Math.min(p.opacity + 0.005, p.targetOpacity) // brighten near text
          }

          // Wobble
          const wobble = Math.sin(t * p.wobbleFreq + p.wobblePhase) * p.wobbleAmp
          p.y += p.vy + wobble * 0.5
          p.x += p.vx

          // Damping
          p.vy *= 0.98
        } else {
          // Burst: decelerate outward
          p.vx *= 0.96
          p.vy *= 0.96
          p.x += p.vx
          p.y += p.vy
        }

        // Remove off-screen stream particles
        if (p.type === 'stream' && (p.x < -50 || p.x > w + 50)) {
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
