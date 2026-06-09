const express = require("express");
const { ROOM_CONFIG } = require("../config/room-config");
const {
  normalizePlayerName,
  normalizeRoomOptions
} = require("../utils/normalizers");
const {
  assignJoinCodeToRoom,
  getJoinCodeByRoomId
} = require("../services/join-code-store");

function createMatchmakingRoutes({ matchMaker }) {
  const router = express.Router();

  router.post("/join", async (req, res) => {
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
        ws_url: ROOM_CONFIG.WS_URL,
        reservation
      });
    } catch (err) {
      res.status(500).json({
        status: "error",
        message: "MATCHMAKING_FAILED"
      });
    }
  });

  return router;
}

module.exports = {
  createMatchmakingRoutes
};
