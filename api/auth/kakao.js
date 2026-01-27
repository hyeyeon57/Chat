const allowCors = require('../_utils/cors');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  const redirectUri = `${CLIENT_URL}/api/auth/kakao/callback`;

  if (!KAKAO_CLIENT_ID) {
    return res.status(500).json({ success: false, message: '카카오 로그인이 설정되지 않았습니다.' });
  }

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  
  res.redirect(kakaoAuthUrl);
});

