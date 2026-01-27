const allowCors = require('../_utils/cors');
const { createRoom } = require('../_utils/rooms');
const pusher = require('../_utils/pusher');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userId, password } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: '사용자 ID가 필요합니다.' 
      });
    }

    const roomId = Math.random().toString(36).substring(2, 11);
    const room = createRoom(roomId, userId, password || null);

    // Pusher를 통해 방 생성 알림 (선택사항)
    await pusher.trigger(`room-${roomId}`, 'room-created', {
      roomId,
      host: userId
    });

    res.json({
      success: true,
      roomId,
      message: '방이 생성되었습니다.'
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ 
      success: false, 
      message: '방 생성에 실패했습니다.' 
    });
  }
});

