const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../../../server/models/User');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { code, state } = req.query;
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
    const redirectUri = `${CLIENT_URL}/api/auth/naver/callback`;

    if (!code) {
      return res.redirect(`${CLIENT_URL}/login?error=naver_auth_failed`);
    }

    // 네이버 토큰 요청
    const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: NAVER_CLIENT_ID,
        client_secret: NAVER_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code: code,
        state: state,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.redirect(`${CLIENT_URL}/login?error=naver_token_failed`);
    }

    // 네이버 사용자 정보 요청
    const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    const providerId = userData.response.id;
    
    let user = await User.findByProviderId('naver', providerId);

    if (!user) {
      user = await User.create({
        email: userData.response.email || `naver_${providerId}@naver.com`,
        name: userData.response.name || userData.response.nickname || '네이버 사용자',
        provider: 'naver',
        providerId: providerId
      });
    }

    const token = generateToken(user);
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}`);
  } catch (error) {
    console.error('Naver callback error:', error);
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${CLIENT_URL}/login?error=naver_error`);
  }
});

