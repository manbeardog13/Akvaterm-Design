// motion.js — MotionDirector: the shared motion grammar for the journey shell.
// Tokens implement docs/motion-language.md, docs/camera-choreography.md and
// docs/material-transition-language.md. Safety constraint: reduced-motion mode
// replaces all dynamic motion with fades only.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MOTION = {
  primary: 380, // primary emotional actions: 280–450ms
  spatial: 1200, // spatial moves: 900–1600ms
  scene: 2200, // long transition scenes: 1.8–2.8s
  easeCamera: "cubic-bezier(0.45, 0, 0.55, 1)", // soft ease-in-out cubic
  easeMaterial: "cubic-bezier(0.19, 1, 0.22, 1)", // material settle curve
};

export class MotionDirector {
  constructor() {
    this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.apply = this.apply.bind(this);
    if (this.mq.addEventListener) this.mq.addEventListener("change", this.apply);
    this.apply();
  }

  get reduced() {
    return this.mq.matches;
  }

  apply() {
    document.documentElement.dataset.motion = this.reduced ? "reduced" : "full";
  }

  // Translucent card appears with a feathered edge (`panel_bloom`).
  panelBloom(el, { delay = 0 } = {}) {
    if (!el || !el.animate) return null;
    if (this.reduced) {
      return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay, easing: "linear", fill: "both" });
    }
    return el.animate(
      [
        { opacity: 0, transform: "translateY(10px) scale(0.985)", filter: "blur(2px)" },
        { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
      ],
      { duration: MOTION.primary, delay, easing: MOTION.easeCamera, fill: "both" }
    );
  }

  // Fade + subpixel drift + micro-luma bloom (`surface_reveal`).
  surfaceReveal(el, { delay = 0 } = {}) {
    if (!el || !el.animate) return null;
    if (this.reduced) {
      return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay, easing: "linear", fill: "both" });
    }
    return el.animate(
      [
        { opacity: 0, transform: "translateY(3px)", filter: "brightness(1.08)" },
        { opacity: 1, transform: "translateY(0)", filter: "brightness(1)" },
      ],
      { duration: 340, delay, easing: MOTION.easeCamera, fill: "both" }
    );
  }

  // Slight push-in for clarity, slow return on confirmation (`focus_shift`).
  focusShift(el) {
    if (!el || !el.animate || this.reduced) return null;
    return el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.014)", offset: 0.3 },
        { transform: "scale(1)" },
      ],
      { duration: 520, easing: MOTION.easeCamera }
    );
  }

  // Pigment-like spread from a seed point with settling (`material_flow`).
  // Duration scales with surface area: 1.2s–3.5s. Cancelable by caller.
  materialFlow(el, { seed = [32, 68], area = 1 } = {}) {
    if (!el || !el.animate) return null;
    const duration = this.reduced ? 220 : clamp(1200 + area * 1400, 1200, 3500);
    if (this.reduced) {
      return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: "linear", fill: "both" });
    }
    return el.animate(
      [
        { clipPath: `circle(0% at ${seed[0]}% ${seed[1]}%)`, filter: "saturate(1.25) brightness(1.06)" },
        { clipPath: `circle(75% at ${seed[0]}% ${seed[1]}%)`, filter: "saturate(1.08) brightness(1.02)", offset: 0.62 },
        { clipPath: `circle(142% at ${seed[0]}% ${seed[1]}%)`, filter: "saturate(1) brightness(1)" },
      ],
      { duration, easing: MOTION.easeMaterial, fill: "both" }
    );
  }

  // Settle the old step out, bloom the new step in. No jump cuts.
  async stepTransition(container, renderNext, direction = 1) {
    if (!this.reduced && container && container.animate) {
      try {
        await container.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: `translateY(${-6 * direction}px)` },
          ],
          { duration: 170, easing: "ease-in", fill: "forwards" }
        ).finished;
      } catch (_) {
        /* interrupted transitions are fine */
      }
    }
    renderNext();
    this.panelBloom(container);
  }

  // Journey enter/exit — spatial tier, wide and calm.
  sceneShift(stageEl) {
    if (!stageEl || !stageEl.animate) return null;
    if (this.reduced) {
      return stageEl.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 260, easing: "linear", fill: "both" });
    }
    return stageEl.animate(
      [
        { opacity: 0.35, transform: "scale(0.992)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: MOTION.spatial, easing: MOTION.easeCamera, fill: "both" }
    );
  }

  // Color/lighting cues precede structural changes: ambient theme crossfades in CSS.
  setAmbient(theme) {
    const layer = document.querySelector(".ambient-layer");
    if (layer) layer.dataset.theme = theme;
  }

  // Live lighting preview for the New-flow lighting step.
  setLightingPreview(warmthK, brightnessPct) {
    const layer = document.querySelector(".ambient-layer");
    if (!layer) return;
    const warm = clamp((6500 - warmthK) / (6500 - 2700), 0, 1); // 1 = warmest
    layer.style.setProperty("--light-warmth", warm.toFixed(3));
    layer.style.setProperty("--light-brightness", (brightnessPct / 100).toFixed(3));
    layer.dataset.lighting = "preview";
  }

  clearLightingPreview() {
    const layer = document.querySelector(".ambient-layer");
    if (layer) delete layer.dataset.lighting;
  }

  // No auto-drift during modal confirmations (camera-choreography safety rule).
  holdIdle(hold) {
    document.documentElement.dataset.idleHold = hold ? "1" : "0";
  }
}
