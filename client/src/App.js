import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import AuthCallback from './components/AuthCallback';
import VideoRoom from './components/VideoRoom';
import JoinRoom from './components/JoinRoom';

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 토큰 검증
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      // 토큰 유효성 검사
      fetch(`${API_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setRoomId(null);
  };

  const handleJoinRoom = (room, user) => {
    setRoomId(room);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/auth/callback" 
            element={<AuthCallback onLogin={handleLogin} />} 
          />
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/join/:roomId"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : (
                <JoinRoom 
                  onJoin={handleJoinRoom} 
                  userName={user.name}
                  onLogout={handleLogout}
                />
              )
            }
          />
          <Route
            path="/"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : !roomId ? (
                <JoinRoom 
                  onJoin={handleJoinRoom} 
                  userName={user.name}
                  onLogout={handleLogout}
                />
              ) : (
                <VideoRoom 
                  roomId={roomId} 
                  userId={user.name} 
                  onLeave={handleLeaveRoom}
                />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

