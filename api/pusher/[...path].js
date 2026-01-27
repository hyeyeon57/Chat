const allowCors = require('../_utils/cors');
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
    if (parts.length >= 3 && parts[0] === 'api' && parts[1] === 'pusher') {
      route = parts.slice(2).join('/');
    }
  }
  
  console.log('Pusher Route:', route, 'Method:', req.method, 'URL:', req.url);

  // Pusher 트리거
  if (route === 'trigger' && req.method === 'POST') {
    try {
      const { channel, event, data } = req.body;

      if (!channel || !event || !data) {
        res.status(400).json({ 
          success: false, 
          message: 'channel, event, data가 필요합니다.' 
        });
        return;
      }

      await pusher.trigger(channel, event, data);

      res.json({
        success: true,
        message: '이벤트가 전송되었습니다.'
      });
      return;
    } catch (error) {
      console.error('Pusher trigger error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: '이벤트 전송에 실패했습니다.' 
        });
      }
      return;
    }
  }

  // 경로를 찾을 수 없음
  res.status(404).json({ success: false, message: 'Not found' });
};

module.exports = allowCors(handler);

