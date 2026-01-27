const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../_utils/users');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const handler = async (req, res) => {
  const { path } = req.query;
  const pathArray = Array.isArray(path) ? path : [path];
  const route = pathArray.join('/');

  // 로그인
  if (route === 'login' && req.method === 'POST') {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        res.status(400).json({ 
          success: false, 
          message: '이메일과 비밀번호를 입력해주세요.' 
        });
        return;
      }

      const user = await User.findByEmail(email);
      if (!user) {
        res.status(401).json({ 
          success: false, 
          message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
        });
        return;
      }

      if (user.provider !== 'local' || !user.password) {
        res.status(401).json({ 
          success: false, 
          message: '소셜 로그인으로 가입한 계정입니다.' 
        });
        return;
      }

      const isPasswordValid = await User.comparePassword(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ 
          success: false, 
          message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
        });
        return;
      }

      const token = generateToken(user);
      res.json({
        success: true,
        message: '로그인되었습니다.',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
      return;
    } catch (error) {
      console.error('Login error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: '서버 오류가 발생했습니다.',
          error: error.message
        });
      }
      return;
    }
  }

  // 회원가입
  if (route === 'register' && req.method === 'POST') {
    try {
      const { email, password, name } = req.body || {};

      if (!email || !password || !name) {
        res.status(400).json({ 
          success: false, 
          message: '이메일, 비밀번호, 이름을 모두 입력해주세요.' 
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ 
          success: false, 
          message: '올바른 이메일 형식이 아닙니다.' 
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ 
          success: false, 
          message: '비밀번호는 최소 6자 이상이어야 합니다.' 
        });
        return;
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        res.status(400).json({ 
          success: false, 
          message: '이미 사용 중인 이메일입니다.' 
        });
        return;
      }

      const user = await User.create({ email, password, name });
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다.',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
      return;
    } catch (error) {
      console.error('Register error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: '서버 오류가 발생했습니다.',
          error: error.message
        });
      }
      return;
    }
  }

  // 토큰 검증
  if (route === 'verify' && req.method === 'GET') {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        res.status(401).json({ 
          success: false, 
          message: '토큰이 제공되지 않았습니다.' 
        });
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        res.status(401).json({ 
          success: false, 
          message: '사용자를 찾을 수 없습니다.' 
        });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
      return;
    } catch (error) {
      res.status(401).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
      return;
    }
  }

  // 카카오 로그인 시작
  if (route === 'kakao' && req.method === 'GET') {
    const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUri = `${CLIENT_URL}/api/auth/kakao/callback`;

    if (!KAKAO_CLIENT_ID) {
      res.status(500).json({ success: false, message: '카카오 로그인이 설정되지 않았습니다.' });
      return;
    }

    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    res.redirect(kakaoAuthUrl);
    return;
  }

  // 카카오 로그인 콜백
  if (route === 'kakao/callback' && req.method === 'GET') {
    try {
      const { code } = req.query;
      const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
      const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID;
      const redirectUri = `${CLIENT_URL}/api/auth/kakao/callback`;

      if (!code) {
        res.redirect(`${CLIENT_URL}/login?error=kakao_auth_failed`);
        return;
      }

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
        res.redirect(`${CLIENT_URL}/login?error=kakao_token_failed`);
        return;
      }

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
      return;
    } catch (error) {
      console.error('Kakao callback error:', error);
      const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${CLIENT_URL}/login?error=kakao_error`);
      return;
    }
  }

  // 네이버 로그인 시작
  if (route === 'naver' && req.method === 'GET') {
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUri = `${CLIENT_URL}/api/auth/naver/callback`;
    const state = Math.random().toString(36).substring(2, 15);

    if (!NAVER_CLIENT_ID) {
      res.status(500).json({ success: false, message: '네이버 로그인이 설정되지 않았습니다.' });
      return;
    }

    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    res.redirect(naverAuthUrl);
    return;
  }

  // 네이버 로그인 콜백
  if (route === 'naver/callback' && req.method === 'GET') {
    try {
      const { code, state } = req.query;
      const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
      const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
      const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
      const redirectUri = `${CLIENT_URL}/api/auth/naver/callback`;

      if (!code) {
        res.redirect(`${CLIENT_URL}/login?error=naver_auth_failed`);
        return;
      }

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
        res.redirect(`${CLIENT_URL}/login?error=naver_token_failed`);
        return;
      }

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
      return;
    } catch (error) {
      console.error('Naver callback error:', error);
      const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${CLIENT_URL}/login?error=naver_error`);
      return;
    }
  }

  // 구글 로그인 시작
  if (route === 'google' && req.method === 'GET') {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUri = `${CLIENT_URL}/api/auth/google/callback`;

    if (!GOOGLE_CLIENT_ID) {
      res.status(500).json({ success: false, message: '구글 로그인이 설정되지 않았습니다.' });
      return;
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email`;
    res.redirect(googleAuthUrl);
    return;
  }

  // 구글 로그인 콜백
  if (route === 'google/callback' && req.method === 'GET') {
    try {
      const { code } = req.query;
      const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${CLIENT_URL}/api/auth/google/callback`;

      if (!code) {
        res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
        return;
      }

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
        res.redirect(`${CLIENT_URL}/login?error=google_token_failed`);
        return;
      }

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
      return;
    } catch (error) {
      console.error('Google callback error:', error);
      const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${CLIENT_URL}/login?error=google_error`);
      return;
    }
  }

  // 경로를 찾을 수 없음
  res.status(404).json({ success: false, message: 'Not found' });
};

module.exports = allowCors(handler);

