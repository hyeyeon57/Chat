const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../_utils/users');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: '이메일과 비밀번호를 입력해주세요.' 
      });
      return;
    }

    // 사용자 찾기
    const user = await User.findByEmail(email);
    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
      return;
    }

    // 로컬 사용자가 아니거나 비밀번호가 없는 경우
    if (user.provider !== 'local' || !user.password) {
      res.status(401).json({ 
        success: false, 
        message: '소셜 로그인으로 가입한 계정입니다.' 
      });
      return;
    }

    // 비밀번호 확인
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
  }
};

module.exports = allowCors(handler);

