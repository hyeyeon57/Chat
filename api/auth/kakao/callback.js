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
    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
    const redirectUri = `${CLIENT_URL}/api/auth/kakao/callback`;

    if (!code) {
      return res.redirect(`${CLIENT_URL}/login?error=kakao_auth_failed`);
    }

    // 카카오 토큰 요청
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID,
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.redirect(`${CLIENT_URL}/login?error=kakao_token_failed`);
    }

    // 카카오 사용자 정보 요청
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    const providerId = userData.id.toString();
    
    let user = await User.findByProviderId('kakao', providerId);

    if (!user) {
      user = await User.create({
        email: userData.kakao_account?.email || `kakao_${providerId}@kakao.com`,
        name: userData.kakao_account?.profile?.nickname || userData.properties?.nickname || '카카오 사용자',
        provider: 'kakao',
        providerId: providerId
      });
    }

    const token = generateToken(user);
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}`);
  } catch (error) {
    console.error('Kakao callback error:', error);
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${CLIENT_URL}/login?error=kakao_error`);
  }
});

