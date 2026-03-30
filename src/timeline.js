/**
 * MASTER TIMELINE — Single source of truth for the entire experience.
 *
 * The timeline is animation-driven (not audio-driven).
 * Audio follows the timeline, not the other way around.
 *
 * Timeline structure:
 *   Phase 0: "I have a dream"
 *   Phase 1: "I have a dream and don't know where to start"
 *   Phase 2: "I want to open a furniture-coffee shop in Austin."
 *   Settle: calm ending
 *
 * Each phase has:
 *   - pause: delay before text starts revealing (build-up)
 *   - revealDuration: how long the text takes to type in
 *   - hold: how long to hold after full reveal
 *   - particleIntensity: 0–1, how dense particles are
 *   - glitchIntensity: 0–1, peak glitch during this phase
 */

export const PHASES = [
  {
    text: 'I have a dream',
    pause: 800,           // gentle start
    revealDuration: 1200, // slow, deliberate
    hold: 1800,           // let it breathe
    particleIntensity: 0.3,
    glitchIntensity: 0.4,
  },
  {
    text: "I have a dream and don't know where to start",
    pause: 600,
    revealDuration: 2200, // longer sentence, slightly faster per-char
    hold: 1400,
    particleIntensity: 0.6,
    glitchIntensity: 0.6,
  },
  {
    text: 'I want to open a furniture-coffee shop in Austin.',
    pause: 1000,          // dramatic pause before the payoff
    revealDuration: 2800, // savor every word
    hold: 3000,           // let it land
    particleIntensity: 1.0,
    glitchIntensity: 0.9,
  },
]

// Total duration of one full cycle
export const SETTLE_DURATION = 2000 // calm ending after last phase
export const TOTAL_DURATION = PHASES.reduce(
  (sum, p) => sum + p.pause + p.revealDuration + p.hold, 0
) + SETTLE_DURATION

// Precompute phase start times (ms from experience start)
const phaseStarts = []
let cursor = 0
for (const p of PHASES) {
  phaseStarts.push({
    pauseStart: cursor,
    revealStart: cursor + p.pause,
    holdStart: cursor + p.pause + p.revealDuration,
    phaseEnd: cursor + p.pause + p.revealDuration + p.hold,
  })
  cursor += p.pause + p.revealDuration + p.hold
}
export const PHASE_STARTS = phaseStarts
export const SETTLE_START = cursor

/**
 * Given elapsed time (ms), compute full timeline state.
 * Returns everything the UI needs to render the current frame.
 */
export function getTimelineState(elapsed) {
  // Clamp to total duration
  const t = Math.min(elapsed, TOTAL_DURATION)

  // Determine which phase we're in
  let phaseIndex = -1
  let phaseProgress = 0 // 0→1 reveal progress within current phase
  let inPause = false
  let inReveal = false
  let inHold = false
  let inSettle = false
  let particleIntensity = 0
  let glitchIntensity = 0

  if (t >= SETTLE_START) {
    // Settle phase — everything calms down
    phaseIndex = PHASES.length - 1
    phaseProgress = 1
    inSettle = true
    const settleProgress = (t - SETTLE_START) / SETTLE_DURATION
    particleIntensity = Math.max(0, 0.3 * (1 - settleProgress))
    glitchIntensity = Math.max(0, 0.05 * (1 - settleProgress))
  } else {
    for (let i = 0; i < PHASES.length; i++) {
      const s = PHASE_STARTS[i]
      if (t < s.phaseEnd) {
        phaseIndex = i
        const phase = PHASES[i]

        if (t < s.revealStart) {
          // In pause (build-up)
          inPause = true
          phaseProgress = 0
          // Ramp up particle intensity during pause
          const pauseProgress = (t - s.pauseStart) / phase.pause
          particleIntensity = phase.particleIntensity * 0.2 * easeInCubic(pauseProgress)
          glitchIntensity = phase.glitchIntensity * 0.1
        } else if (t < s.holdStart) {
          // Revealing text
          inReveal = true
          const rawProgress = (t - s.revealStart) / phase.revealDuration
          phaseProgress = easeOutCubic(rawProgress) // eased reveal
          particleIntensity = phase.particleIntensity
          glitchIntensity = phase.glitchIntensity * (0.3 + 0.7 * Math.sin(rawProgress * Math.PI))
        } else {
          // Holding after reveal
          inHold = true
          phaseProgress = 1
          const holdProgress = (t - s.holdStart) / phase.hold
          // Particles and glitch gradually settle
          particleIntensity = phase.particleIntensity * (1 - holdProgress * 0.6)
          glitchIntensity = phase.glitchIntensity * (0.15 * (1 - holdProgress))
        }
        break
      }
    }
  }

  // Build displayed text from phases
  let displayText = ''
  let targetText = ''
  if (phaseIndex >= 0) {
    targetText = PHASES[phaseIndex].text
    const prevText = phaseIndex > 0 ? PHASES[phaseIndex - 1].text : ''

    // Common prefix
    let prefixLen = 0
    for (let i = 0; i < Math.min(prevText.length, targetText.length); i++) {
      if (prevText[i] === targetText[i]) prefixLen++
      else break
    }

    const newChars = targetText.length - prefixLen
    const revealedNewChars = Math.floor(newChars * phaseProgress)
    displayText = targetText.slice(0, prefixLen + revealedNewChars)
  }

  // Overall experience progress (0→1)
  const overallProgress = t / TOTAL_DURATION

  return {
    elapsed: t,
    phaseIndex,
    phaseProgress,
    displayText,
    targetText,
    inPause,
    inReveal,
    inHold,
    inSettle,
    particleIntensity,
    glitchIntensity,
    overallProgress,
    isComplete: t >= TOTAL_DURATION,
    isFinalPhase: phaseIndex === PHASES.length - 1,
  }
}

// Easing functions
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function easeInCubic(t) { return t * t * t }
