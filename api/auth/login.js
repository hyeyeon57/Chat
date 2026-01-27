const allowCors = require('../_utils/cors');
const { generateToken } = require('../_utils/auth');
const User = require('../_utils/users');

module.exports = allowCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '이메일과 비밀번호를 입력해주세요.' 
      });
    }

    // 사용자 찾기
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    // 로컬 사용자가 아니거나 비밀번호가 없는 경우
    if (user.provider !== 'local' || !user.password) {
      return res.status(401).json({ 
        success: false, 
        message: '소셜 로그인으로 가입한 계정입니다.' 
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

