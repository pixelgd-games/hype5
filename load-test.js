// load-test.js
// Hype5 minimal local load test

const Colyseus = require("colyseus.js");

const WS_URL = "ws://127.0.0.1:2567";
const TOTAL_CLIENTS = 20;
const JOIN_DELAY_MS = 80;

const client = new Colyseus.Client(WS_URL);
const rooms = [];
let successCount = 0;
let failCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function joinOne(index) {
  try {
    const room = await client.joinOrCreate("hype5_room", {
      name: `BOT_${index + 1}`
    });

    rooms.push(room);
    successCount += 1;

    console.log(
      `[OK] #${index + 1} joined room=${room.roomId} success=${successCount} fail=${failCount}`
    );

    room.onMessage("fake_tip_event", () => {});
    room.onMessage("player_snapshot", () => {});
    room.onMessage("room_lifecycle", () => {});
  } catch (err) {
    failCount += 1;
    console.log(
      `[FAIL] #${index + 1} ${err.message || err} success=${successCount} fail=${failCount}`
    );
  }
}

async function run() {
  console.log(`Starting load test: ${TOTAL_CLIENTS} clients`);

  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    await joinOne(i);
    await sleep(JOIN_DELAY_MS);
  }

  console.log("");
  console.log("=== LOAD TEST RESULT ===");
  console.log("success:", successCount);
  console.log("fail:", failCount);
  console.log("open_rooms:", [...new Set(rooms.map((r) => r.roomId))].length);
  console.log("total_connections:", rooms.length);
  console.log("");
  console.log("Press Ctrl+C to close test clients.");

  process.stdin.resume();
  process.on("SIGINT", async () => {
    console.log("\nClosing rooms...");
    for (const room of rooms) {
      try {
        await room.leave();
      } catch (e) {}
    }
    process.exit(0);
  });
}

run();