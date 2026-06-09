function parseIntegerEnv(name, fallback, options = {}) {
  const raw = process.env[name];
  const parsed = Number(raw);

  if (!raw || !Number.isFinite(parsed)) {
    return fallback;
  }

  const min = Number.isFinite(options.min) ? options.min : parsed;
  const max = Number.isFinite(options.max) ? options.max : parsed;

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

const PORT = parseIntegerEnv("PORT", 2567, { min: 1, max: 65535 });
const HOST = process.env.HOST || "localhost";

const ROOM_CONFIG = {
  PORT,
  HOST,
  WS_URL: process.env.WS_URL || `ws://${HOST}:${PORT}`,
  ROOM_CLEANUP_DELAY_MS: parseIntegerEnv("ROOM_CLEANUP_DELAY_MS", 10000, { min: 0 }),
  MOVE_RATE_LIMIT_MS: parseIntegerEnv("MOVE_RATE_LIMIT_MS", 80, { min: 0 }),
  MIN_CLIENTS_PER_ROOM: parseIntegerEnv("MIN_CLIENTS_PER_ROOM", 2, { min: 1 }),
  DEFAULT_GAME_ID: process.env.DEFAULT_GAME_ID || "default",
  DEFAULT_ROOM_TYPE: process.env.DEFAULT_ROOM_TYPE || "default",
  MAX_CLIENTS_PER_ROOM: parseIntegerEnv("MAX_CLIENTS_PER_ROOM", 10, { min: 1 })
};

module.exports = {
  ROOM_CONFIG
};
