# Feroterm Integration Architecture

## Objective

Show customers curated, real-stock recommendations from a trusted ecosystem without overwhelming browsing complexity.

## Core approach

- Maintain a normalized Feroterm master index in the app backend cache.
- Expose only constrained recommendation sets per journey stage.
- Bind each recommendation to:
  - style profile
  - room constraints
  - compatibility rules
  - confidence band

## Data entities

- `Product` (id, sku, family, dimensions, installation constraints)
- `Category` (showers, taps, fittings, heating, mirrors, storage, flooring, tile, lighting)
- `Compatibility` (fixture pair rules, spacing requirements)
- `InventoryState` (availability, lead time, location)

## Recommendation gates

1. Context gate: only items relevant to current stage.
2. Feasibility gate: only valid with current room constraints.
3. Quality gate: premium set per style profile.
4. Budget-sensitivity gate: avoid overloading low-cost users with luxury-only defaults.

## Interaction rule

- Never show full catalogue.
- Start with 6 candidates max per stage.
- Always offer "one expert alternative" as fallback.

