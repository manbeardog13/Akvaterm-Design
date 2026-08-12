# Motion Language Specification

## Purpose

Define the animation grammar that feels intentional, premium, and calm.

## Global rules

- Always animate state transitions at a minimum of 280ms.
- No jump cuts for core scene flow.
- Keep all motion physically plausible.
- Prioritize readability over spectacle.
- Prefer layered dissolves and soft parallax.

## Transition tokens

- `surface_reveal`: fade + subpixel drift + micro-luma bloom.
- `focus_shift`: depth blur + focus snap, no abrupt rotation.
- `panel_bloom`: translucent card appears with feathered edge.
- `material_flow`: non-linear spread from seeded points with settling.

## Speed tiers

- Primary emotional actions: 280ms–450ms
- Spatial moves: 900ms–1600ms
- Long transition scenes: 1.8s–2.8s

## Anti-patterns

- spinner-only loading states (replace with progress + context)
- rapid button bounce
- full-screen desaturating transitions
- repetitive loops without user context change
