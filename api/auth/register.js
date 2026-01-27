const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../_utils/users');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { email, password, name } = req.body || {};

    // 유효성 검사
    if (!email || !password || !name) {
      res.status(400).json({ 
        success: false, 
        message: '이메일, 비밀번호, 이름을 모두 입력해주세요.' 
      });
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        success: false, 
        message: '올바른 이메일 형식이 아닙니다.' 
      });
      return;
    }

    // 비밀번호 길이 검사
    if (password.length < 6) {
      res.status(400).json({ 
        success: false, 
        message: '비밀번호는 최소 6자 이상이어야 합니다.' 
      });
      return;
    }

    // 중복 이메일 확인
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res.status(400).json({ 
        success: false, 
        message: '이미 사용 중인 이메일입니다.' 
      });
      return;
    }

    // 사용자 생성
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
  }
};

module.exports = allowCors(handler);

