const allowCors = require('../_utils/cors');
const pusher = require('../_utils/pusher');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { channel, event, data } = req.body;

    if (!channel || !event || !data) {
      return res.status(400).json({ 
        success: false, 
        message: 'channel, event, data가 필요합니다.' 
      });
    }

    await pusher.trigger(channel, event, data);

    res.json({
      success: true,
      message: '이벤트가 전송되었습니다.'
    });
  } catch (error) {
    console.error('Pusher trigger error:', error);
    res.status(500).json({ 
      success: false, 
      message: '이벤트 전송에 실패했습니다.' 
    });
  }
});

