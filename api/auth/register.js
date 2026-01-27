const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../_utils/users');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email, password, name } = req.body || {};

    // 유효성 검사
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        message: '이메일, 비밀번호, 이름을 모두 입력해주세요.' 
      });
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: '올바른 이메일 형식이 아닙니다.' 
      });
    }

    // 비밀번호 길이 검사
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: '비밀번호는 최소 6자 이상이어야 합니다.' 
      });
    }

    // 중복 이메일 확인
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: '이미 사용 중인 이메일입니다.' 
      });
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
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

