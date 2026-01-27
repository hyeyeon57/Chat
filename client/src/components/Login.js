import React, { useState } from 'react';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      // 응답이 비어있는지 확인
      const text = await response.text();
      if (!text) {
        throw new Error('서버 응답이 비어있습니다.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Response text:', text);
        throw new Error('서버 응답을 파싱할 수 없습니다.');
      }

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (autoLogin) {
          localStorage.setItem('autoLogin', 'true');
        }
        onLogin(data.user);
      } else {
        setError(data.message || '오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || '서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSNSLogin = (provider) => {
    window.location.href = `${API_URL}/api/auth/${provider}`;
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">ZOOM-IN</h1>
        <p className="login-tagline">
          화상 회의를 통해 내 면접 피드백을 실시간으로 받아보세요!
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
                required
                className="form-input"
              />
              <span className="input-icon envelope">✉</span>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">이름</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="이름을 입력하세요"
                  required
                  className="form-input"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="비밀번호를 입력하세요"
                required
                minLength={6}
                className="form-input"
              />
              <button
                type="button"
                className="input-icon eye"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {isLogin && (
            <div className="login-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                />
                <span>자동 로그인</span>
              </label>
              <button
                type="button"
                className="reset-password-link"
                onClick={() => {
                  // 비밀번호 재설정 기능은 추후 구현
                  alert('비밀번호 재설정 기능은 준비 중입니다.');
                }}
              >
                비밀번호 재설정
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>

        <div className="divider">
          <span>또는</span>
        </div>

        <div className="social-login-section">
          <button
            onClick={() => handleSNSLogin('google')}
            className="social-btn google-btn"
            title="Google로 로그인"
          >
            <span className="social-icon">G</span>
          </button>
          <button
            onClick={() => handleSNSLogin('kakao')}
            className="social-btn kakao-btn"
            title="카카오로 로그인"
          >
            <span className="social-icon">💬</span>
          </button>
          <button
            onClick={() => handleSNSLogin('naver')}
            className="social-btn naver-btn"
            title="네이버로 로그인"
          >
            <span className="social-icon">N</span>
          </button>
        </div>

        <div className="switch-mode">
          <span>아직 계정이 없으신가요?</span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ email: '', password: '', name: '' });
            }}
            className="switch-btn"
          >
            {isLogin ? '회원가입' : '로그인'}
          </button>
        </div>

        <div className="footer">
          <p>ZOOM-IN과 함께, 더 자신 있는 면접을 경험해보세요.</p>
          <div className="footer-links">
            <button type="button" className="footer-link-btn" onClick={() => alert('이용약관')}>
              이용약관
            </button>
            <button type="button" className="footer-link-btn" onClick={() => alert('개인정보처리방침')}>
              개인정보처리방침
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

