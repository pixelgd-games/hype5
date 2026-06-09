const { ROOM_CONFIG } = require("../config/room-config");

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

module.exports = {
  normalizeLabel,
  normalizeMaxClients,
  normalizePlayerName,
  normalizeRoomOptions
};
