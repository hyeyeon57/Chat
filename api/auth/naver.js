const allowCors = require('../_utils/cors');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  const redirectUri = `${CLIENT_URL}/api/auth/naver/callback`;
  const state = Math.random().toString(36).substring(2, 15);

  if (!NAVER_CLIENT_ID) {
    return res.status(500).json({ success: false, message: '네이버 로그인이 설정되지 않았습니다.' });
  }

  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
  res.redirect(naverAuthUrl);
});

