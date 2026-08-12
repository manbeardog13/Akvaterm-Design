# UX Blueprint

## Screen flow

```mermaid
flowchart TD
  A[Home / Arrival] --> B{Bathroom type}
  B -->|Existing| C[Dimensions + Initial render]
  B -->|New| D[Mood + style exploration]
  C --> E[Door placement]
  E --> F[Wall capture]
  F --> G[AI detect + user confirm]
  G --> H[Reconstruction]
  H --> I[Recommendations]
  I --> J[Summary packet]
  D --> K[Space concept model]
  K --> I
  J --> L[Sales handoff]
```

## Interaction principles

- Keep each screen under one decision.
- Use ambient visuals and no hard transitions.
- Provide always-visible progress state.
- Keep one primary action visible, one secondary action available.

## Failure handling

- Missing room photos: degrade to guided sketch mode while keeping tone supportive.
- Low-confidence detection: request second-angle shots with explicit reason.
- No upload support: provide manual measurement fallback.

## Accessibility baseline

- Contrast-aware contrast ratio and non-color-only cues.
- Keyboard-first navigation in all controls.
- Motion preference handling (reduce-motion fallback).

