// 메모리 기반 방 관리 (서버리스에서는 상태가 유지되지 않으므로 실제로는 외부 DB 사용 권장)
// 프로덕션에서는 Redis나 데이터베이스 사용
const rooms = new Map();

const createRoom = (roomId, userId, password) => {
  rooms.set(roomId, {
    users: new Set([userId]),
    password: password || null,
    host: userId,
    createdAt: new Date().toISOString()
  });
  return rooms.get(roomId);
};

const getRoom = (roomId) => {
  return rooms.get(roomId);
};

const joinRoom = (roomId, userId) => {
  const room = rooms.get(roomId);
  if (room) {
    room.users.add(userId);
  }
  return room;
};

const leaveRoom = (roomId, userId) => {
  const room = rooms.get(roomId);
  if (room) {
    room.users.delete(userId);
    if (room.users.size === 0) {
      rooms.delete(roomId);
    }
  }
  return room;
};

module.exports = { createRoom, getRoom, joinRoom, leaveRoom };

