const http = require("http");
const cors = require("cors");
const express = require("express");
const { Server, matchMaker } = require("colyseus");
const { ROOM_CONFIG } = require("./config/room-config");
const { Hype5Room } = require("./rooms/Hype5Room");
const { createHealthRoutes } = require("./routes/health-routes");
const { createMatchmakingRoutes } = require("./routes/matchmaking-routes");
const { createRoomRoutes } = require("./routes/room-routes");

let WebSocketTransport;
try {
  ({ WebSocketTransport } = require("@colyseus/ws-transport"));
} catch (e) {
  WebSocketTransport = null;
}

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(createHealthRoutes());
  app.use("/rooms", createRoomRoutes({ matchMaker }));
  app.use("/matchmaking", createMatchmakingRoutes({ matchMaker }));

  return app;
}

function createGameServer(appServer) {
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

  return gameServer;
}

function startServer() {
  const app = createApp();
  const appServer = http.createServer(app);
  const gameServer = createGameServer(appServer);

  appServer.listen(ROOM_CONFIG.PORT, () => {
    console.log(`[boot] Hype5 running at http://${ROOM_CONFIG.HOST}:${ROOM_CONFIG.PORT}`);
    console.log(`[boot] WS URL: ${ROOM_CONFIG.WS_URL}`);
  });

  return {
    app,
    appServer,
    gameServer
  };
}

module.exports = {
  createApp,
  createGameServer,
  startServer
};
