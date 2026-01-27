const allowCors = require('../_utils/cors');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  const redirectUri = `${CLIENT_URL}/api/auth/google/callback`;

  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ success: false, message: '구글 로그인이 설정되지 않았습니다.' });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email`;
  
  res.redirect(googleAuthUrl);
});

