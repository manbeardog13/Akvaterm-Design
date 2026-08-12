# Information Architecture

## Top level sections

- Onboarding
- Journey selection (Existing vs New)
- Journey workbench
- Recommendations
- Summary & contact handoff
- Profile and project notes

## Information hierarchy

### Core entities

- Project
- Space model
- Detected fixture set
- Style profile
- Material profile
- Recommendation set
- Confidence state
- Sales-ready proposal

### Navigation principles

- One clear path, no branching menus.
- Journey step remains the strongest context.
- Never force catalog browsing; only category-narrowed suggestions.
- Primary actions use sticky micro-commands:
  - Continue
  - Confirm
  - Adjust
  - Next suggestion

## Data model summary

1. `project`: id, flow type, dimensions, location context
2. `space`: walls, openings, floor/ceiling baseline, room anchor
3. `fixtureDetection`: object type, coordinates, confidence, user-verified flag
4. `styleProfile`: primary style, mood scores, color families
5. `materialProfile`: floor/wall/fixture palette with transition IDs
6. `recommendations`: ranked bundle, rationale, estimated effort tier
7. `handoffPacket`: customer notes, constraints, selected concepts

