const express = require("express");
const { ROOM_CONFIG } = require("../config/room-config");
const { normalizeRoomOptions } = require("../utils/normalizers");
const {
  assignJoinCodeToRoom,
  deleteJoinCode,
  getJoinCodeByRoomId,
  getRoomIdByJoinCode
} = require("../services/join-code-store");

function createRoomRoutes({ matchMaker }) {
  const router = express.Router();

  router.post("/create", async (req, res) => {
    const roomOptions = normalizeRoomOptions(req.body);

    try {
      const room = await matchMaker.createRoom("hype5_room", roomOptions);
      const join_code =
        getJoinCodeByRoomId(room.roomId) ||
        assignJoinCodeToRoom(room.roomId);

      res.json({
        status: "ok",
        join_code,
        room_id: room.roomId,
        game_id: roomOptions.game_id,
        room_type: roomOptions.room_type,
        max_clients: roomOptions.max_clients,
        ws_url: ROOM_CONFIG.WS_URL
      });
    } catch (err) {
      res.status(500).json({
        status: "error",
        message: "ROOM_CREATE_FAILED"
      });
    }
  });

  router.get("/resolve/:code", async (req, res) => {
    const code = String(req.params.code || "").toUpperCase();
    const roomId = getRoomIdByJoinCode(code);

    if (!roomId) {
      return res.status(404).json({
        status: "not_found"
      });
    }

    try {
      const room = await matchMaker.query({ roomId });

      if (!room || room.length === 0) {
        deleteJoinCode(code);
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
        ws_url: ROOM_CONFIG.WS_URL
      });
    } catch (err) {
      return res.status(500).json({
        status: "error",
        message: "ROOM_RESOLVE_FAILED"
      });
    }
  });

  return router;
}

module.exports = {
  createRoomRoutes
};
