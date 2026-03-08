// test_client.js
// Hype5 local multiplayer test client

const Colyseus = require("colyseus.js");
const readline = require("readline");

const playerName = process.argv[2] || "TestPlayer";
const client = new Colyseus.Client("ws://127.0.0.1:2567");

async function run() {
  try {
    const room = await client.joinOrCreate("hype5_room", {
      name: playerName
    });

    console.log("✅ connected to room:", room.roomId, "| name:", playerName);

    room.onMessage("welcome", (msg) => {
      console.log("\nWELCOME:");
      console.log("roomId:", msg.roomId);
      console.log("name:", msg.name);
      console.log("room_state:", msg.room_state);
    });

    room.onMessage("player_snapshot", (msg) => {
      console.clear();
      console.log("ROOM:", msg.room_id, "| SELF:", playerName);
      console.log("ROOM STATE:", msg.room_state);
      console.log("PLAYERS:");

      for (const p of msg.players) {
        console.log("-", p.name, "pos:", p.x, p.y);
      }

      console.log("\nControls:");
      console.log("WASD = move");
      console.log("T = fake tip");
      console.log("J = room_start");
      console.log("K = room_end");
      console.log("Ctrl+C = exit");
    });

    room.onMessage("fake_tip_event", (msg) => {
      console.log("\nFAKE TIP EVENT:");
      console.log("from:", msg.from);
      console.log("amount:", msg.amount);
      console.log("effect:", msg.effect);
    });

    room.onMessage("room_lifecycle", (msg) => {
      console.log("\nROOM LIFECYCLE:", msg.room_state);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdin.setRawMode(true);

    process.stdin.on("data", (key) => {
      const k = key.toString().toLowerCase();

      if (k === "w") room.send("move", { dx: 0, dy: -1 });
      if (k === "s") room.send("move", { dx: 0, dy: 1 });
      if (k === "a") room.send("move", { dx: -1, dy: 0 });
      if (k === "d") room.send("move", { dx: 1, dy: 0 });

      if (k === "t") {
        room.send("fake_tip", {
          amount: 100,
          effect: "spark"
        });
      }

      if (k === "j") room.send("room_start");
      if (k === "k") room.send("room_end");
      if (k === "\u0003") process.exit();
    });

    rl.on("line", () => {});
  } catch (err) {
    console.error("❌ connection error:", err.message || err);
  }
}

run();