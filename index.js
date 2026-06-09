// index.js - Hype5 v1 stable room engine

const http = require("http");
const express = require("express");
const { Server, Room, matchMaker } = require("colyseus");
const { ROOM_CONFIG } = require("./room-config");

let WebSocketTransport;
try {
  ({ WebSocketTransport } = require("@colyseus/ws-transport"));
} catch (e) {
  WebSocketTransport = null;
}

const PORT = ROOM_CONFIG.PORT;
const HOST = ROOM_CONFIG.HOST;
const WS_URL = `ws://${HOST}:${PORT}`;

function normalizeLabel(value, fallback) {
  if (typeof value !== "string") return fallback;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 40);

  return normalized || fallback;
}

function normalizePlayerName(value) {
  if (typeof value !== "string") return "Guest";

  const normalized = value.trim().slice(0, 20);
  return normalized || "Guest";
}

function normalizeMaxClients(value) {
  const n = Number(value ?? ROOM_CONFIG.MAX_CLIENTS_PER_ROOM);

  if (!Number.isFinite(n)) {
    return ROOM_CONFIG.MAX_CLIENTS_PER_ROOM;
  }

  return Math.max(
    ROOM_CONFIG.MIN_CLIENTS_PER_ROOM,
    Math.min(ROOM_CONFIG.MAX_CLIENTS_PER_ROOM, Math.floor(n))
  );
}

function normalizeRoomOptions(data = {}) {
  return {
    game_id: normalizeLabel(data.game_id, ROOM_CONFIG.DEFAULT_GAME_ID),
    room_type: normalizeLabel(data.room_type, ROOM_CONFIG.DEFAULT_ROOM_TYPE),
    max_clients: normalizeMaxClients(data.max_clients)
  };
}

/*
------------------------------------------------
Join Code Mapping
------------------------------------------------
*/
const joinCodeMap = new Map();
const roomJoinCodeMap = new Map();

function randomJoinCode4() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function allocateJoinCodeUnique() {
  let code = randomJoinCode4();
  while (joinCodeMap.has(code)) {
    code = randomJoinCode4();
  }
  return code;
}

function assignJoinCodeToRoom(roomId) {
  const existing = roomJoinCodeMap.get(roomId);
  if (existing) return existing;

  const code = allocateJoinCodeUnique();
  joinCodeMap.set(code, roomId);
  roomJoinCodeMap.set(roomId, code);
  return code;
}

function getJoinCodeByRoomId(roomId) {
  return roomJoinCodeMap.get(roomId) || null;
}

function removeJoinCodeByRoomId(roomId) {
  const code = roomJoinCodeMap.get(roomId);
  if (!code) return null;

  roomJoinCodeMap.delete(roomId);
  joinCodeMap.delete(code);
  return code;
}

/*
------------------------------------------------
Hype5 Room
------------------------------------------------
*/

class Hype5Room extends Room {
  maxClients = ROOM_CONFIG.MAX_CLIENTS_PER_ROOM;

  onCreate(options = {}) {
    console.log("room created:", this.roomId);

    this.players = {};
    this.chat = [];
    this.cleanup_timer = null;

    this.room_state = "waiting";
    this.created_at = Date.now();
    this.started_at = null;
    this.ended_at = null;

    this.game_id = normalizeLabel(options.game_id, ROOM_CONFIG.DEFAULT_GAME_ID);
    this.room_type = normalizeLabel(options.room_type, ROOM_CONFIG.DEFAULT_ROOM_TYPE);
    this.maxClients = normalizeMaxClients(options.max_clients);
    this.join_code = assignJoinCodeToRoom(this.roomId);

    this.autoDispose = false;
    this.updateRoomMetadata();

    this.onMessage("room_start", () => {
      if (this.room_state !== "waiting") return;

      this.room_state = "playing";
      this.started_at = Date.now();
      this.lock().catch((err) => {
        console.error("room lock failed:", this.roomId, err.message || err);
      });

      this.broadcastRoomLifecycle();
      console.log("room started:", this.roomId);
    });

    this.onMessage("room_end", () => {
      if (this.room_state !== "playing") return;
      this.endRoom();
    });

    this.onMessage("set_name", (client, data) => {
      const p = this.players[client.sessionId];
      if (!p) return;

      if (typeof data?.name === "string") {
        p.name = data.name.slice(0, 20);
      }

      this.broadcastPlayerSnapshot();
    });

    this.onMessage("move", (client, data) => {
      const p = this.players[client.sessionId];
      if (!p) return;

      const now = Date.now();
      const lastMoveAt = p.last_move_at || 0;

      if (now - lastMoveAt < ROOM_CONFIG.MOVE_RATE_LIMIT_MS) {
        return;
      }

      const dx = Number(data?.dx ?? 0);
      const dy = Number(data?.dy ?? 0);

      p.last_move_at = now;
      p.x += Math.max(-5, Math.min(5, dx));
      p.y += Math.max(-5, Math.min(5, dy));

      this.broadcastPlayerSnapshot();
    });

    this.onMessage("chat", (client, data) => {
      const p = this.players[client.sessionId];
      if (!p) return;

      const msg =
        typeof data?.msg === "string"
          ? data.msg.slice(0, 120)
          : "";

      if (!msg) return;

      const item = {
        t: Date.now(),
        from: p.name,
        msg
      };

      this.chat.push(item);

      if (this.chat.length > 50) {
        this.chat.shift();
      }

      this.broadcast("chat", item);
    });

    this.onMessage("fake_tip", (client, data) => {
      const p = this.players[client.sessionId];
      if (!p) return;

      const amount = Number(data?.amount ?? 0);
      const effect =
        typeof data?.effect === "string"
          ? data.effect.slice(0, 30)
          : "tip";

      if (!Number.isFinite(amount) || amount <= 0) return;

      this.broadcast("fake_tip_event", {
        t: Date.now(),
        from: p.name,
        amount: Math.floor(amount),
        effect
      });
    });
  }

  onAuth() {
    const playerCount = Object.keys(this.players).length;

    if (playerCount >= this.maxClients) {
      throw new Error("ROOM_FULL");
    }

    if (this.room_state === "playing") {
      throw new Error("ROOM_ALREADY_PLAYING");
    }

    if (this.room_state === "ended") {
      throw new Error("ROOM_ALREADY_ENDED");
    }

    return true;
  }

  onJoin(client, options) {
    const name = normalizePlayerName(options?.name);

    this.players[client.sessionId] = {
      session_id: client.sessionId,
      name,
      x: 0,
      y: 0,
      last_move_at: 0
    };

    console.log(client.sessionId, "joined");

    client.send("welcome", {
      roomId: this.roomId,
      join_code: this.join_code,
      game_id: this.game_id,
      room_type: this.room_type,
      name,
      room_state: this.room_state,
      created_at: this.created_at,
      started_at: this.started_at,
      ended_at: this.ended_at
    });

    client.send("player_snapshot", this.buildPlayerSnapshot());
    this.broadcastPlayerSnapshot();
  }

  onLeave(client) {
    delete this.players[client.sessionId];
    console.log(client.sessionId, "left");

    this.broadcastPlayerSnapshot();

    const playerCount = Object.keys(this.players).length;

    if (playerCount === 0 && this.room_state !== "ended") {
      this.endRoom();
    }
  }

  buildPlayerSnapshot() {
    const players = Object.values(this.players).map((p) => ({
      session_id: p.session_id,
      name: p.name,
      x: p.x,
      y: p.y
    }));

    return {
      room_id: this.roomId,
      join_code: this.join_code,
      game_id: this.game_id,
      room_type: this.room_type,
      room_state: this.room_state,
      created_at: this.created_at,
      started_at: this.started_at,
      ended_at: this.ended_at,
      players
    };
  }

  buildRoomMetadata() {
    return {
      room_state: this.room_state,
      join_code: this.join_code,
      game_id: this.game_id,
      room_type: this.room_type,
      max_clients: this.maxClients,
      created_at: this.created_at,
      started_at: this.started_at,
      ended_at: this.ended_at
    };
  }

  updateRoomMetadata() {
    this.setMetadata(this.buildRoomMetadata());
  }

  broadcastRoomLifecycle() {
    this.updateRoomMetadata();

    this.broadcast("room_lifecycle", {
      join_code: this.join_code,
      game_id: this.game_id,
      room_type: this.room_type,
      room_state: this.room_state,
      created_at: this.created_at,
      started_at: this.started_at,
      ended_at: this.ended_at
    });
  }

  broadcastPlayerSnapshot() {
    this.broadcast("player_snapshot", this.buildPlayerSnapshot());
  }

  endRoom() {
    if (this.room_state === "ended") return;

    this.room_state = "ended";
    this.ended_at = Date.now();
    this.lock().catch((err) => {
      console.error("room lock failed:", this.roomId, err.message || err);
    });

    this.broadcastRoomLifecycle();
    console.log("room ended:", this.roomId);

    this.scheduleRoomCleanup();
  }

  scheduleRoomCleanup() {
    if (this.cleanup_timer) return;

    this.cleanup_timer = setTimeout(() => {
      const removedCode = removeJoinCodeByRoomId(this.roomId);

      console.log("room cleanup:", this.roomId, removedCode || "(no join code)");

      this.disconnect();
    }, ROOM_CONFIG.ROOM_CLEANUP_DELAY_MS);
  }

  onDispose() {
    if (this.cleanup_timer) {
      clearTimeout(this.cleanup_timer);
      this.cleanup_timer = null;
    }

    removeJoinCodeByRoomId(this.roomId);
    console.log("room disposed:", this.roomId);
  }
}

/*
------------------------------------------------
Express API
------------------------------------------------
*/

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.send("ok");
});

app.get("/status", (req, res) => {
  res.send("Hype5 Server Running");
});

app.post("/rooms/create", async (req, res) => {
  const roomOptions = normalizeRoomOptions(req.body);

  const room = await matchMaker.createRoom("hype5_room", roomOptions);
  const join_code = getJoinCodeByRoomId(room.roomId) || assignJoinCodeToRoom(room.roomId);

  if (!room.metadata?.join_code) {
    room.metadata = {
      ...(room.metadata || {}),
      join_code
    };
  }

  res.json({
    status: "ok",
    join_code,
    room_id: room.roomId,
    game_id: roomOptions.game_id,
    room_type: roomOptions.room_type,
    max_clients: roomOptions.max_clients,
    ws_url: WS_URL
  });
});

app.post("/matchmaking/join", async (req, res) => {
  const roomOptions = normalizeRoomOptions(req.body);
  const playerOptions = {
    ...roomOptions,
    name: normalizePlayerName(req.body?.name)
  };

  try {
    const reservation = await matchMaker.joinOrCreate("hype5_room", playerOptions);
    const join_code =
      getJoinCodeByRoomId(reservation.room.roomId) ||
      assignJoinCodeToRoom(reservation.room.roomId);

    res.json({
      status: "ok",
      match_status: "reserved",
      join_code,
      room_id: reservation.room.roomId,
      game_id: roomOptions.game_id,
      room_type: roomOptions.room_type,
      max_clients: reservation.room.maxClients,
      ws_url: WS_URL,
      reservation
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "MATCHMAKING_FAILED"
    });
  }
});

app.get("/rooms/resolve/:code", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const roomId = joinCodeMap.get(code);

  if (!roomId) {
    return res.status(404).json({
      status: "not_found"
    });
  }

  try {
    const room = await matchMaker.query({ roomId });

    if (!room || room.length === 0) {
      joinCodeMap.delete(code);
      return res.status(404).json({
        status: "not_found"
      });
    }

    const target = room[0];

    if (target.locked) {
      return res.status(409).json({
        status: "not_joinable",
        room_state: target.metadata?.room_state || "locked"
      });
    }

    if (target.metadata?.room_state && target.metadata.room_state !== "waiting") {
      return res.status(409).json({
        status: "not_joinable",
        room_state: target.metadata.room_state
      });
    }

    if (target.clients >= target.maxClients) {
      return res.status(409).json({
        status: "not_joinable",
        room_state: target.metadata?.room_state || "waiting",
        reason: "room_full"
      });
    }

    res.json({
      status: "ok",
      join_code: code,
      room_id: roomId,
      game_id: target.metadata?.game_id || ROOM_CONFIG.DEFAULT_GAME_ID,
      room_type: target.metadata?.room_type || ROOM_CONFIG.DEFAULT_ROOM_TYPE,
      max_clients: target.maxClients,
      ws_url: WS_URL
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "ROOM_RESOLVE_FAILED"
    });
  }
});

/*
------------------------------------------------
Server Boot
------------------------------------------------
*/

const appServer = http.createServer(app);

const gameServer = new Server({
  transport: WebSocketTransport
    ? new WebSocketTransport({ server: appServer })
    : undefined
});

gameServer.define("hype5_room", Hype5Room, {
  metadata: {
    room_state: "waiting",
    game_id: ROOM_CONFIG.DEFAULT_GAME_ID,
    room_type: ROOM_CONFIG.DEFAULT_ROOM_TYPE
  }
}).filterBy(["game_id", "room_type"]);

const originalOnCreate = Hype5Room.prototype.onCreate;
Hype5Room.prototype.onCreate = function (...args) {
  originalOnCreate.apply(this, args);
  this.updateRoomMetadata();
};

appServer.listen(PORT, () => {
  console.log(`[boot] Hype5 running at http://${HOST}:${PORT}`);
  console.log(`[boot] WS URL: ${WS_URL}`);
});
