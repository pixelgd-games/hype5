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

/*
------------------------------------------------
Join Code Mapping
------------------------------------------------
*/
const joinCodeMap = new Map();

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

function removeJoinCodeByRoomId(roomId) {
  for (const [code, mappedRoomId] of joinCodeMap.entries()) {
    if (mappedRoomId === roomId) {
      joinCodeMap.delete(code);
      return code;
    }
  }
  return null;
}

/*
------------------------------------------------
Hype5 Room
------------------------------------------------
*/

class Hype5Room extends Room {
  maxClients = ROOM_CONFIG.MAX_CLIENTS_PER_ROOM;

  onCreate() {
    console.log("room created:", this.roomId);

    this.players = {};
    this.chat = [];
    this.cleanup_timer = null;

    this.room_state = "waiting";
    this.created_at = Date.now();
    this.started_at = null;
    this.ended_at = null;

    this.autoDispose = false;

    this.onMessage("room_start", () => {
      if (this.room_state !== "waiting") return;

      this.room_state = "playing";
      this.started_at = Date.now();

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
    const name =
      typeof options?.name === "string"
        ? options.name.slice(0, 20)
        : "Guest";

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
      room_state: this.room_state,
      created_at: this.created_at,
      started_at: this.started_at,
      ended_at: this.ended_at,
      players
    };
  }

  broadcastRoomLifecycle() {
    this.setMetadata({
      room_state: this.room_state
    });

    this.broadcast("room_lifecycle", {
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
  const join_code = allocateJoinCodeUnique();

  const room = await matchMaker.createRoom("hype5_room", {});

  joinCodeMap.set(join_code, room.roomId);

  res.json({
    status: "ok",
    join_code,
    room_id: room.roomId,
    ws_url: WS_URL
  });
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

    if (target.metadata?.room_state && target.metadata.room_state !== "waiting") {
      return res.status(409).json({
        status: "not_joinable",
        room_state: target.metadata.room_state
      });
    }

    res.json({
      status: "ok",
      join_code: code,
      room_id: roomId,
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
    room_state: "waiting"
  }
});

const originalOnCreate = Hype5Room.prototype.onCreate;
Hype5Room.prototype.onCreate = function (...args) {
  originalOnCreate.apply(this, args);
  this.setMetadata({
    room_state: this.room_state
  });
};

appServer.listen(PORT, () => {
  console.log(`[boot] Hype5 running at http://${HOST}:${PORT}`);
  console.log(`[boot] WS URL: ${WS_URL}`);
});