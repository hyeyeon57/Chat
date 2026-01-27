const allowCors = require('../_utils/cors');
const { getRoom } = require('../_utils/rooms');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { roomId } = req.query;

    if (!roomId) {
      return res.status(400).json({ 
        success: false, 
        message: '방 ID가 필요합니다.' 
      });
    }

    const room = getRoom(roomId);
    
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: '방을 찾을 수 없습니다.' 
      });
    }

    res.json({
      success: true,
      hasPassword: !!room.password,
      userCount: room.users.size,
      users: Array.from(room.users)
    });
  } catch (error) {
    console.error('Get room info error:', error);
    res.status(500).json({ 
      success: false, 
      message: '방 정보를 가져오는데 실패했습니다.' 
    });
  }
});

