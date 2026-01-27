const allowCors = require('../_utils/cors');
const { getRoom, joinRoom } = require('../_utils/rooms');
const pusher = require('../_utils/pusher');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { roomId, userId, password } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: '방 ID와 사용자 ID가 필요합니다.' 
      });
    }

    const room = getRoom(roomId);
    
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: '방을 찾을 수 없습니다.' 
      });
    }

    // 비밀번호 확인
    if (room.password && room.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: '비밀번호가 올바르지 않습니다.' 
      });
    }

    // 방 참가
    joinRoom(roomId, userId);

    // Pusher를 통해 다른 사용자들에게 알림
    const existingUsers = Array.from(room.users).filter(id => id !== userId);
    await pusher.trigger(`room-${roomId}`, 'user-joined', {
      userId,
      existingUsers
    });

    res.json({
      success: true,
      message: '방에 참가했습니다.',
      existingUsers
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ 
      success: false, 
      message: '방 참가에 실패했습니다.' 
    });
  }
});

