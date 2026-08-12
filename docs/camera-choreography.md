## Camera choreography language

### Principles

- No abrupt zooms or axis jumps.
- 30-second idle wait before automatic movement.
- Keep user framing reference during camera shifts.
- Always preserve north orientation during transitions.

### Scene states

1. Arrival
   - Wide establishing view
   - Static for 30s unless explicit user action
2. Engagement
   - gentle dolly/slide to touched element
3. Confirmation
   - slight push-in for clarity, slow return on confirmation
4. Discovery
   - panoramic sweep with low angular speed and no disorientation
5. Transition
   - color/lighting cues precede structural changes

### Timing profile

- Auto transition: 1.8 to 2.8s
- Soft easing: ease-in-out cubic
- User-triggered transitions only after action end or explicit continue
- Idle drift: minimal, 0.15%/s parallax only in background

### Safety constraints

- No movement while detection confidence is < 0.45.
- No auto-pan during modal confirmations.
- Reduced-motion mode replaces all dynamic motion with fades only.
