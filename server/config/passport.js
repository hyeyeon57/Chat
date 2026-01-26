const passport = require('passport');
const KakaoStrategy = require('passport-kakao').Strategy;
const NaverStrategy = require('passport-naver').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// 세션 직렬화
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// 카카오 로그인 전략
passport.use(new KakaoStrategy({
  clientID: process.env.KAKAO_CLIENT_ID || 'your-kakao-client-id',
  callbackURL: '/api/auth/kakao/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id.toString();
    let user = await User.findByProviderId('kakao', providerId);

    if (!user) {
      // 새 사용자 생성
      user = await User.create({
        email: profile._json.kakao_account?.email || `kakao_${providerId}@kakao.com`,
        name: profile.displayName || profile.username,
        provider: 'kakao',
        providerId: providerId
      });
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// 네이버 로그인 전략
passport.use(new NaverStrategy({
  clientID: process.env.NAVER_CLIENT_ID || 'your-naver-client-id',
  clientSecret: process.env.NAVER_CLIENT_SECRET || 'your-naver-client-secret',
  callbackURL: '/api/auth/naver/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    let user = await User.findByProviderId('naver', providerId);

    if (!user) {
      // 새 사용자 생성
      user = await User.create({
        email: profile.emails?.[0]?.value || `naver_${providerId}@naver.com`,
        name: profile.displayName || profile.name,
        provider: 'naver',
        providerId: providerId
      });
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Google 로그인 전략
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    let user = await User.findByProviderId('google', providerId);

    if (!user) {
      // 새 사용자 생성
      user = await User.create({
        email: profile.emails?.[0]?.value || `google_${providerId}@gmail.com`,
        name: profile.displayName || profile.name?.givenName || 'Google User',
        provider: 'google',
        providerId: providerId
      });
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport;

