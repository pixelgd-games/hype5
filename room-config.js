// room-config.js

const ROOM_CONFIG = {
  PORT: 2567,
  HOST: "localhost",
  ROOM_CLEANUP_DELAY_MS: 10000,
  MOVE_RATE_LIMIT_MS: 80,
  MIN_CLIENTS_PER_ROOM: 2,
  DEFAULT_GAME_ID: "default",
  DEFAULT_ROOM_TYPE: "default",
  MAX_CLIENTS_PER_ROOM: 10
};

module.exports = {
  ROOM_CONFIG
};
