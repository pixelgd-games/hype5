const joinCodeMap = new Map();
const roomJoinCodeMap = new Map();

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

function assignJoinCodeToRoom(roomId) {
  const existing = roomJoinCodeMap.get(roomId);
  if (existing) return existing;

  const code = allocateJoinCodeUnique();
  joinCodeMap.set(code, roomId);
  roomJoinCodeMap.set(roomId, code);
  return code;
}

function deleteJoinCode(code) {
  const roomId = joinCodeMap.get(code);

  joinCodeMap.delete(code);

  if (roomId) {
    roomJoinCodeMap.delete(roomId);
  }
}

function getJoinCodeByRoomId(roomId) {
  return roomJoinCodeMap.get(roomId) || null;
}

function getRoomIdByJoinCode(code) {
  return joinCodeMap.get(code) || null;
}

function removeJoinCodeByRoomId(roomId) {
  const code = roomJoinCodeMap.get(roomId);
  if (!code) return null;

  roomJoinCodeMap.delete(roomId);
  joinCodeMap.delete(code);

  return code;
}

module.exports = {
  assignJoinCodeToRoom,
  deleteJoinCode,
  getJoinCodeByRoomId,
  getRoomIdByJoinCode,
  removeJoinCodeByRoomId
};
