const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
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

// 카카오 로그인 시작
router.get('/kakao', passport.authenticate('kakao'));

// 카카오 로그인 콜백
router.get('/kakao/callback', 
  passport.authenticate('kakao', { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    // 프론트엔드로 리다이렉트하면서 토큰 전달
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback?token=${token}&name=${encodeURIComponent(req.user.name)}`);
  }
);

// 네이버 로그인 시작
router.get('/naver', passport.authenticate('naver'));

// 네이버 로그인 콜백
router.get('/naver/callback',
  passport.authenticate('naver', { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    // 프론트엔드로 리다이렉트하면서 토큰 전달
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback?token=${token}&name=${encodeURIComponent(req.user.name)}`);
  }
);

// Google 로그인 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google 로그인 콜백
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = generateToken(req.user);
    // 프론트엔드로 리다이렉트하면서 토큰 전달
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback?token=${token}&name=${encodeURIComponent(req.user.name)}`);
  }
);

module.exports = router;

