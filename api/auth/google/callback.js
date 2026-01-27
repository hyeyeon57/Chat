const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../../../server/models/User');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { code } = req.query;
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${CLIENT_URL}/api/auth/google/callback`;

    if (!code) {
      return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
    }

    // 구글 토큰 요청
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.redirect(`${CLIENT_URL}/login?error=google_token_failed`);
    }

    // 구글 사용자 정보 요청
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    const providerId = userData.id;
    
    let user = await User.findByProviderId('google', providerId);

    if (!user) {
      user = await User.create({
        email: userData.email || `google_${providerId}@gmail.com`,
        name: userData.name || userData.given_name || '구글 사용자',
        provider: 'google',
        providerId: providerId
      });
    }

    const token = generateToken(user);
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}`);
  } catch (error) {
    console.error('Google callback error:', error);
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${CLIENT_URL}/login?error=google_error`);
  }
});

