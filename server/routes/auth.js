const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// JWT 토큰 생성
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

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

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

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

// 토큰 검증
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '토큰이 제공되지 않았습니다.' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: '유효하지 않은 토큰입니다.' 
    });
  }
});

module.exports = router;

