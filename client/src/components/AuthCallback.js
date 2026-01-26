import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AuthCallback({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      localStorage.setItem('token', token);
      
      // 사용자 정보 가져오기
      fetch(`${API_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user);
            navigate('/');
          } else {
            navigate('/login');
          }
        })
        .catch(error => {
          console.error('Auth callback error:', error);
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, onLogin, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh' 
    }}>
      <div>로그인 처리 중...</div>
    </div>
  );
}

export default AuthCallback;

