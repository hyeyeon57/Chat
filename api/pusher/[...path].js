const allowCors = require('../_utils/cors');
const pusher = require('../_utils/pusher');

const handler = async (req, res) => {
  const { path } = req.query;
  const pathArray = Array.isArray(path) ? path : [path];
  const route = pathArray.join('/');

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

