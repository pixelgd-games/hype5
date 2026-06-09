# Hype5

Hype5 is a **realtime room synchronization engine**.

It is designed for small room-based multiplayer games. Its job is to handle room lifecycle, player connections, state synchronization, event broadcasting, join-code management, and room cleanup.

## 1. Purpose

Hype5 is responsible for:

- Creating, joining, and ending rooms
- Lightweight automatic matchmaking for waiting rooms
- Managing player connections
- Synchronizing room and player state
- Broadcasting in-room events
- Managing join codes and room metadata
- Providing a basic foundation for snapshots and reconnect flows

Hype5 is not:

- A game logic server
- An RNG or probability adjudication engine
- An economy settlement engine
- An MMO world server

## 2. Responsibility Boundary

### Hype5 Handles

- Room lifecycle
- Basic matchmaking
- Player connections
- Room state sync
- Event broadcast
- Join validation
- Room cleanup
- Basic snapshot and reconnect support

### Hype5 Does Not Handle

- Game rules
- RNG or probability
- Economy settlement
- Persistent world simulation
- Heavy physics
- MMO world management

## 3. Architecture Position

```text
Pixel GD / Client
        |
        | WebSocket
        v
Hype5
Realtime Room Sync Engine
        |
        +-- Aura     (general game logic)
        +-- FuGhost  (gambling/probability adjudication)
        +-- Spinnova (economy/ledger)
```

## 4. Suitable Use Cases

Hype5 is a good fit for:

- 2D room-based games
- Small multiplayer matches
- Board games and card games
- Small RPG party rooms
- Fish game rooms
- Live interaction rooms
- Tipping or interaction event broadcasts
- Small multiplayer interactions with around 2-10 players per room

Hype5 is not a good fit for:

- MMO games
- Large open worlds
- Large numbers of players in the same map
- High-frequency FPS, fighting games, or large MOBA-style competitive sync
- Large-scale physics simulation

## 5. Current Tech Stack

- Node.js
- Express
- Colyseus
- WebSocket
- `@colyseus/ws-transport`

## 6. Project Files

Current local MVP files:

```text
hype5-server/
  index.js
  room-config.js
  test_client.js
  load-test.js
  package.json
  README.md
```

## 7. Local Setup

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm run dev
```

Default local endpoints:

- HTTP: `http://localhost:2567`
- WebSocket: `ws://localhost:2567`

## 8. Test Commands

Run local test clients:

```bash
node test_client.js P1
node test_client.js P2
```

Run the local lightweight load test:

```bash
node load-test.js
```

## 9. Completed Features in the Local MVP

Completed:

- Hype5 server can start locally
- Colyseus room is registered and can be created/joined
- `test_client` can join a room successfully

Room lifecycle:

- `waiting`
- `playing`
- `ended`
- `room_start` and `room_end` switch room state
- `welcome` message returns room lifecycle information

Basic join validation:

- Joining is blocked when the room is already playing
- Joining is blocked when the room has ended

Enhanced join validation:

- `resolve/:code` only accepts rooms in `waiting` state
- `playing` and `ended` rooms return `not_joinable`

Room cleanup:

- Room cleanup is delayed after `room_end`
- Room is automatically disposed after cleanup
- Join code creation, resolution, and cleanup have been verified

Empty-room handling:

- The room automatically ends when all players leave
- The room is disposed after the cleanup delay

Player sync and snapshot:

- Server broadcasts `player_snapshot`
- New clients immediately receive a snapshot after joining

Other completed basics:

- Movement rate limiting
- Fake tip / interaction event broadcasting
- `fake_tip` is broadcast as `fake_tip_event`
- Lightweight automatic matchmaking via `POST /matchmaking/join`
- Room matching by `game_id` and `room_type`
- Per-room `max_clients` support, clamped by server config
- Room configuration is extracted to `room-config.js`

Local two-client testing:

- Two clients can join the same room
- Coordinates sync between clients
- Fake tip events broadcast correctly

Local lightweight load test:

- 20 clients tested
- Success: 20
- Fail: 0

## 10. Current Local Completion

The local MVP is approximately **98%-100% complete**.

It can be considered complete for local MVP validation.

## 11. Room End Strategy

Room ending should not always be controlled by a fixed timer.

It should depend on the room type or `end_mode`.

Recommended `end_mode` values:

- `on_empty`
- `on_timer`
- `manual`
- `match_based`

Meaning:

- `on_empty`: End the room when all players leave
- `on_timer`: End the room when time runs out
- `manual`: End the room manually by host or system command
- `match_based`: End the room according to game rules

## 12. Local MVP Conclusion

Hype5 currently supports:

- Room creation, joining, and ending
- Lightweight automatic room matching
- Small-room multiplayer synchronization
- Join-code resolution and protection
- In-room event broadcasting
- Automatic empty-room ending
- Basic snapshot sync
- Basic throttling protection
- Basic local load testing

The local MVP validation can be considered complete.

## 13. Next Stage

Possible next steps:

- Render deployment
- Cloud validation
- Supabase room metadata integration
- Stronger snapshot and reconnect support
- Room structure modularization
- Discord or monitoring integration

## 14. Current API

Health:

```http
GET /health
```

Status:

```http
GET /status
```

Create room:

```http
POST /rooms/create
```

Resolve join code:

```http
GET /rooms/resolve/:code
```

Auto-match into a waiting room:

```http
POST /matchmaking/join
```

Example request:

```json
{
  "name": "PlayerOne",
  "game_id": "fish_game",
  "room_type": "casual",
  "max_clients": 4
}
```

Example response:

```json
{
  "status": "ok",
  "match_status": "reserved",
  "join_code": "ABCD",
  "room_id": "roomId",
  "game_id": "fish_game",
  "room_type": "casual",
  "max_clients": 4,
  "ws_url": "ws://localhost:2567",
  "reservation": {
    "sessionId": "sessionId",
    "room": {}
  }
}
```

Clients should consume the returned `reservation` with Colyseus:

```js
const room = await client.consumeSeatReservation(result.reservation);
```

## 15. Development Principles

- Hype5 only handles synchronization. It should not contain game logic.
- Room-based games come first. Do not turn this into an MMO server.
- Build a runnable MVP first, then harden it step by step.
- Keep each room small, preferably around 10 players or fewer.
- Keep the design modular and avoid letting the room class become too large.

## 16. Notes

This is the local MVP wrap-up version.

Cloud deployment, Supabase metadata, monitoring, and stronger reconnect/snapshot behavior belong to the next stage.
