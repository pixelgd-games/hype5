const { Room } = require("colyseus");
const { ROOM_CONFIG } = require("../config/room-config");
const {
  normalizeLabel,
  normalizeMaxClients,
  normalizePlayerName
} = require("../utils/normalizers");
const {
  assignJoinCodeToRoom,
  removeJoinCodeByRoomId
} = require("../services/join-code-store");

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
      this.lockRoom();

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

      const msg = typeof data?.msg === "string"
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
      const effect = typeof data?.effect === "string"
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
    this.lockRoom();

    this.broadcastRoomLifecycle();
    console.log("room ended:", this.roomId);

    this.scheduleRoomCleanup();
  }

  lockRoom() {
    this.lock().catch((err) => {
      console.error("room lock failed:", this.roomId, err.message || err);
    });
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

module.exports = {
  Hype5Room
};
