import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import './JoinRoom.css';

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

function JoinRoom({ onJoin, userName, onLogout }) {
  const { roomId: urlRoomId } = useParams();
  const [mode, setMode] = useState('create'); // 'create' or 'join'
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [roomLink, setRoomLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAutoJoin = useCallback(async (roomIdToJoin) => {
    if (!roomIdToJoin || loading) return;
    
    setError('');
    setLoading(true);

    try {
      // 방 정보 확인
      const infoResponse = await fetch(`${API_URL}/api/rooms/info?roomId=${roomIdToJoin}`);
      const roomInfo = await infoResponse.json();

      if (!roomInfo.success) {
        setError(roomInfo.message || '방을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      // 비밀번호가 필요한 경우는 자동 참가하지 않음
      if (roomInfo.hasPassword) {
        setError('이 방은 비밀번호가 필요합니다.');
        setLoading(false);
        return;
      }

      // 고유 사용자 ID 생성
      const uniqueUserId = `${userName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 방 참가
      const joinResponse = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomIdToJoin,
          userId: uniqueUserId,
          originalUserId: userName,
          password: null
        })
      });

      const joinData = await joinResponse.json();
      
      if (joinData.success) {
        localStorage.setItem('currentUniqueUserId', uniqueUserId);
        onJoin(roomIdToJoin, userName);
      } else {
        setError(joinData.message || '방 참가에 실패했습니다.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Auto join room error:', error);
      setError('방 참가에 실패했습니다.');
      setLoading(false);
    }
  }, [userName, onJoin, loading]);

  useEffect(() => {
    // URL에서 roomId가 있으면 자동으로 참가 모드로 설정하고 참가 시도
    if (urlRoomId) {
      setMode('join');
      setRoomId(urlRoomId);
      // 자동으로 참가 시도 (약간의 지연을 두어 상태가 설정된 후 실행)
      setTimeout(() => {
        handleAutoJoin(urlRoomId);
      }, 500);
    }
  }, [urlRoomId, handleAutoJoin]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 고유 사용자 ID 생성
      const uniqueUserId = `${userName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const response = await fetch(`${API_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: uniqueUserId, // 고유 ID 사용
          originalUserId: userName, // 원래 사용자 이름도 함께 전송
          password: password || null
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // 고유 ID를 localStorage에 저장
        localStorage.setItem('currentUniqueUserId', uniqueUserId);
        const link = `${window.location.origin}/join/${data.roomId}`;
        setRoomLink(link);
        setRoomId(data.roomId);
        console.log('Room created:', data.roomId, 'userCount:', data.userCount);
      } else {
        setError(data.message || '방 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Create room error:', error);
      setError('방 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!roomId.trim()) {
      setError('방 ID를 입력하세요.');
      setLoading(false);
      return;
    }

    // 링크에서 방 ID 추출 (다양한 형식 지원)
    let actualRoomId = roomId.trim();
    
    // 전체 URL 형식: http://.../join/roomId
    const fullUrlMatch = roomId.match(/\/join\/([a-z0-9]+)/);
    if (fullUrlMatch) {
      actualRoomId = fullUrlMatch[1];
    }
    // 상대 URL 형식: /join/roomId
    else if (roomId.startsWith('/join/')) {
      actualRoomId = roomId.replace('/join/', '');
    }
    // 방 ID만 입력한 경우 그대로 사용
    else {
      actualRoomId = roomId.trim();
    }

    // 방 ID 유효성 검사 (영문자와 숫자만 허용)
    if (!/^[a-z0-9]+$/.test(actualRoomId)) {
      setError('올바른 방 ID 형식이 아닙니다. (영문자와 숫자만 사용 가능)');
      setLoading(false);
      return;
    }

    try {
      // 방 정보 확인
      const infoResponse = await fetch(`${API_URL}/api/rooms/info?roomId=${actualRoomId}`);
      
      if (!infoResponse.ok) {
        throw new Error(`HTTP error! status: ${infoResponse.status}`);
      }
      
      const roomInfo = await infoResponse.json();

      if (!roomInfo.success) {
        setError(roomInfo.message || '방을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      // 비밀번호가 필요한 경우
      if (roomInfo.hasPassword && !password.trim()) {
        setError('비밀번호를 입력하세요.');
        setLoading(false);
        return;
      }

      // 고유 사용자 ID 생성 (같은 브라우저의 다른 탭에서도 구분)
      const uniqueUserId = `${userName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 방 참가
      const joinResponse = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: actualRoomId,
          userId: uniqueUserId, // 고유 ID 사용
          originalUserId: userName, // 원래 사용자 이름도 함께 전송
          password: password || null
        })
      });

      if (!joinResponse.ok) {
        throw new Error(`HTTP error! status: ${joinResponse.status}`);
      }

      const joinData = await joinResponse.json();
      
      if (joinData.success) {
        // 고유 ID를 localStorage에 저장하여 VideoRoom에서 사용
        localStorage.setItem('currentUniqueUserId', uniqueUserId);
        console.log('Successfully joined room:', actualRoomId);
        onJoin(actualRoomId, userName);
      } else {
        setError(joinData.message || '방 참가에 실패했습니다.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Join room error:', error);
      setError(error.message || '방 참가에 실패했습니다. 서버 연결을 확인해주세요.');
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomLink).then(() => {
      alert('링크가 클립보드에 복사되었습니다!');
    });
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: '화상 회의 초대',
        text: `${userName}님이 화상 회의에 초대했습니다.`,
        url: roomLink
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="join-room-container">
      <div className="join-room-card">
        <div className="join-room-header">
          <h1 className="join-room-title">화상 회의</h1>
          <div className="user-info">
            <span>안녕하세요, {userName}님</span>
            <button onClick={onLogout} className="logout-btn">로그아웃</button>
          </div>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
            onClick={() => {
              setMode('create');
              setError('');
              setRoomId('');
              setPassword('');
              setRoomLink('');
            }}
          >
            회의 만들기
          </button>
          <button
            className={`mode-btn ${mode === 'join' ? 'active' : ''}`}
            onClick={() => {
              setMode('join');
              setError('');
              setRoomId('');
              setPassword('');
              setRoomLink('');
            }}
          >
            회의 참가
          </button>
        </div>

        {mode === 'create' ? (
          <>
            {!roomLink ? (
              <form onSubmit={handleCreateRoom} className="join-room-form">
                <p className="join-room-subtitle">새로운 회의를 만들고 링크를 공유하세요</p>
                
                <div className="form-group">
                  <label htmlFor="createPassword">비밀번호 (선택사항)</label>
                  <input
                    type="password"
                    id="createPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요 (선택사항)"
                    className="form-input"
                  />
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="join-btn" disabled={loading}>
                  {loading ? '생성 중...' : '회의 만들기'}
                </button>
              </form>
            ) : (
              <div className="room-created">
                <p className="join-room-subtitle">회의가 생성되었습니다!</p>
                
                <div className="form-group">
                  <label>회의 링크</label>
                  <div className="link-container">
                    <input
                      type="text"
                      value={roomLink}
                      readOnly
                      className="link-input"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="copy-btn"
                      title="링크 복사"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {password && (
                  <div className="form-group">
                    <label>비밀번호</label>
                    <input
                      type="text"
                      value={password}
                      readOnly
                      className="form-input"
                    />
                  </div>
                )}

                <div className="share-buttons">
                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="share-btn"
                  >
                    링크 공유하기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // 방 생성 시 생성한 고유 ID가 이미 localStorage에 저장되어 있음
                      onJoin(roomId, userName);
                    }}
                    className="join-btn"
                  >
                    회의 시작하기
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleJoinRoom} className="join-room-form">
            <p className="join-room-subtitle">회의 링크 또는 방 ID를 입력하세요</p>
            
            <div className="form-group">
              <label htmlFor="roomId">방 ID 또는 링크</label>
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="방 ID만 입력하거나 전체 링크를 입력하세요 (예: fq0osp6vu 또는 http://.../join/fq0osp6vu)"
                required
                className="form-input"
              />
              <small className="form-hint">방 ID만 입력해도 참가할 수 있습니다.</small>
            </div>

            <div className="form-group">
              <label htmlFor="joinPassword">비밀번호 (필요한 경우)</label>
              <input
                type="password"
                id="joinPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="form-input"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="join-btn" disabled={loading}>
              {loading ? '참가 중...' : '참가하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default JoinRoom;
