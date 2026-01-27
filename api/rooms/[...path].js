const allowCors = require('../_utils/cors');
const { createRoom, getRoom, joinRoom } = require('../_utils/rooms');
const pusher = require('../_utils/pusher');

const handler = async (req, res) => {
  // Vercel 동적 라우팅에서 경로 파싱
  let route = '';
  if (req.query.path) {
    const pathArray = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
    route = pathArray.join('/');
  } else if (req.url) {
    const urlPath = req.url.split('?')[0];
    const parts = urlPath.split('/').filter(p => p);
    if (parts.length >= 3 && parts[0] === 'api' && parts[1] === 'rooms') {
      route = parts.slice(2).join('/');
    }
  }
  
  console.log('Rooms Route:', route, 'Method:', req.method, 'URL:', req.url);

  // 방 생성
  if (route === 'create' && req.method === 'POST') {
    try {
      const { userId, password } = req.body;

      if (!userId) {
        res.status(400).json({ 
          success: false, 
          message: '사용자 ID가 필요합니다.' 
        });
        return;
      }

      const roomId = Math.random().toString(36).substring(2, 11);
      const room = createRoom(roomId, userId, password || null);

      await pusher.trigger(`room-${roomId}`, 'room-created', {
        roomId,
        host: userId
      });

      res.json({
        success: true,
        roomId,
        message: '방이 생성되었습니다.'
      });
      return;
    } catch (error) {
      console.error('Create room error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: '방 생성에 실패했습니다.' 
        });
      }
      return;
    }
  }

  // 방 참가
  if (route === 'join' && req.method === 'POST') {
    try {
      const { roomId, userId, password } = req.body;

      if (!roomId || !userId) {
        res.status(400).json({ 
          success: false, 
          message: '방 ID와 사용자 ID가 필요합니다.' 
        });
        return;
      }

      const room = getRoom(roomId);
      
      if (!room) {
        res.status(404).json({ 
          success: false, 
          message: '방을 찾을 수 없습니다.' 
        });
        return;
      }

      if (room.password && room.password !== password) {
        res.status(401).json({ 
          success: false, 
          message: '비밀번호가 올바르지 않습니다.' 
        });
        return;
      }

      joinRoom(roomId, userId);

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
      return;
    } catch (error) {
      console.error('Join room error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: '방 참가에 실패했습니다.' 
        });
      }
      return;
    }
  }

  // 방 정보 조회
  if (route === 'info' && req.method === 'GET') {
    try {
      const { roomId } = req.query;

      if (!roomId) {
        res.status(400).json({ 
          success: false, 
          message: '방 ID가 필요합니다.' 
        });
        return;
      }

      const room = getRoom(roomId);
      
      if (!room) {
        res.status(404).json({ 
          success: false, 
          message: '방을 찾을 수 없습니다.' 
        });
        return;
      }

      res.json({
        success: true,
        hasPassword: !!room.password,
        userCount: room.users.size,
        users: Array.from(room.users)
      });
      return;
    } catch (error) {
      console.error('Get room info error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: '방 정보를 가져오는데 실패했습니다.' 
        });
      }
      return;
    }
  }

  // 경로를 찾을 수 없음
  res.status(404).json({ success: false, message: 'Not found' });
};

module.exports = allowCors(handler);

