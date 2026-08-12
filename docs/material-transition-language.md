# Material Transition Language

## Principle

Material changes should appear handcrafted and natural, not instant.

## Stages

1. Seed
   - small localized particles emerge at edges and seams.
2. Flow
   - pigment-like spread follows wall topology.
3. Settle
   - local variations smooth into a uniform render.
4. Lock
   - subtle specular alignment and edge cleanup.

## Transition profiles

- Tiles: angular spread + grout edge settling.
- Stone: marbled flow with large organic pools.
- Wood: soft grain drift aligned with directionality.
- Metal: directional reflection bloom with controlled spread.

## Timing and controls

- Duration: 1.2s–3.5s depending on surface area.
- Curve: cubic-bezier(0.19, 1, 0.22, 1)
- Always cancelable with immediate revert.
- If user reopens control before settle, continue from current frame.
