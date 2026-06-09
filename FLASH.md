# Flash System Positioning

This project is one module within the broader **Flash** architecture.

Flash is not a single program or a single website.

Flash is a modular game system made of multiple components that can be developed independently, connected only when needed, and integrated with each other depending on the product.

Current Flash modules include:

- **Looty**: Game entry point, player platform, lobby, and admin tools
- **GD Games**: Game content and frontend presentation layer
- **Aura**: General authoritative game logic server
- **Hype5**: Realtime multiplayer synchronization, room synchronization, and room engine
- **FuGhost**: Gambling result adjudication, probability calculation, and adjudication engine
- **Spinnova**: Wallet, economy settlement, ledger, and settlement system

---

## Important Principles

1. **These modules do not always need to be used together**

   Different products, games, and flows should only connect the modules they actually need.

2. **Do not assume every flow must pass through every module**

   Flash is a modular system, not a single fixed pipeline.

3. **Do not move sibling-module responsibilities into this project**

   Each module has its own responsibility boundary. Keep those boundaries clear.

4. **Understand this project's own role before reasoning about broader Flash integration**

   First understand what this project is responsible for and what it is not responsible for. Only then consider how it may cooperate with other modules.

5. **This document helps AI/Codex understand context. It is not a mandatory integration rulebook**

   Do not add unnecessary coupling, dependencies, flows, or abstractions just because other modules exist.

---

## Common Flash Module Collaboration Patterns

These are common patterns for understanding the architecture. They are examples, not mandatory rules.

General single-player games may use:

- Looty
- GD Games
- Aura

General multiplayer games may use:

- Looty
- GD Games
- Hype5
- Aura

Gambling single-player games may use:

- Looty
- GD Games
- FuGhost

Gambling multiplayer games may use:

- Looty
- GD Games
- Hype5
- FuGhost

Products that need currency flow, economy settlement, or ledger behavior may additionally use:

- Spinnova

Again:

- Not every project needs to know every detail
- Not every project needs to directly depend on every other module
- Whether to integrate and how to integrate should be decided by actual product requirements

---

## This Project's Role in Flash

This project is **Hype5**.

Hype5's role in Flash:

- Realtime multiplayer synchronization engine
- Room synchronization and room engine
- Lightweight room matching, connection management, room lifecycle, state sync, and broadcast module

---

## What Hype5 Handles

Hype5 is mainly responsible for:

- Room lifecycle
- Lightweight room matching for waiting rooms
- Player connection management
- Room creation, joining, and leaving
- Snapshot, reconnect, and sync foundation
- Realtime event broadcasting
- Multiplayer synchronization flow control
- Join validation
- Room cleanup

---

## What Hype5 Does Not Handle

Hype5 is not responsible for:

- General game rule adjudication
- Win/loss decisions
- Gambling probability adjudication
- Economy settlement or ledger behavior
- Frontend game presentation

Most important principle:

**Hype5 must not contain game logic.**

---

## How Hype5 Relates to Other Modules

Hype5 is the multiplayer synchronization layer.

It usually receives multiplayer interaction from the frontend, then hands off anything requiring authoritative processing to other modules.

Common examples:

- General multiplayer game: GD Games -> Hype5 -> Aura
- Gambling multiplayer game: GD Games -> Hype5 -> FuGhost

However, Hype5 itself should not assume that every multiplayer room must be tied to a specific backend adjudicator.

It should remain a flexible, general-purpose synchronization layer.

---

## Current Deployment and Infrastructure Notes

Current deployment direction for Flash-related modules and infrastructure:

- Aura -> Render Singapore
- Hype5 -> Render Singapore
- FuGhost -> Currently Cloudflare Workers, with a longer-term direction toward Render Singapore
- Frontend sites -> Cloudflare Pages
- Database, auth, and RPC -> Supabase

This information is included to explain the overall system layout and possible connection paths.

It does not mean this project must actively couple itself to every platform or deployment detail.

---

## Implementation Notes for AI/Codex

When working in this project, follow these principles:

1. Prioritize this project's own responsibility boundary. Do not pull responsibilities from other Flash modules into Hype5.
2. It is useful to understand sibling modules, but do not add cross-project coupling without an explicit requirement.
3. Do not treat possible integration paths as mandatory architecture.
4. If this project does not explicitly require integration with another module, do not add that dependency.
5. Keep this project clear, independently runnable, and narrowly focused.
