# Recommendation Engine Architecture

## Inputs

- journey stage
- space model
- style profile
- material profile
- detected fixture constraints
- project budget tier
- Feroterm availability signals

## Output bundle

- recommendation cards grouped by priority
- confidence, rationale, alternatives
- risk level and install complexity
- clear next-step action

## Ranking model (v1)

- deterministic rules + scored heuristics:
  - compatibility score
  - trust score
  - style coherence score
  - ease score
  - aesthetic uplift score

## Anti-bias and guardrails

- cap list length to avoid choice fatigue
- avoid repetitive style loops across steps
- always include non-premium and premium alternatives in distinct lanes

## Auditability

- every recommendation includes rationale and rule reference
- every automatic suggestion is user-adjustable
- every recommendation set is logged as a reversible state
