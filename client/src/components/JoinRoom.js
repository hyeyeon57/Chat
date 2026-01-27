import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './JoinRoom.css';

const API_URL = process.env.REACT_APP_API_URL || '';

function JoinRoom({ onJoin, userName, onLogout }) {
  const { roomId: urlRoomId } = useParams();
  const [mode, setMode] = useState('create'); // 'create' or 'join'
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [roomLink, setRoomLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // URL에서 roomId가 있으면 자동으로 참가 모드로 설정
    if (urlRoomId) {
      setMode('join');
      setRoomId(urlRoomId);
    }
  }, [urlRoomId]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userName,
          password: password || null
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const link = `${window.location.origin}/join/${data.roomId}`;
        setRoomLink(link);
        setRoomId(data.roomId);
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

    // 링크에서 방 ID 추출
    let actualRoomId = roomId.trim();
    const match = roomId.match(/\/join\/([a-z0-9]+)/);
    if (match) {
      actualRoomId = match[1];
    }

    try {
      // 방 정보 확인
      const infoResponse = await fetch(`${API_URL}/api/rooms/info?roomId=${actualRoomId}`);
      const roomInfo = await infoResponse.json();

      if (!roomInfo.success) {
        setError(roomInfo.message);
        setLoading(false);
        return;
      }

      // 비밀번호가 필요한 경우
      if (roomInfo.hasPassword && !password.trim()) {
        setError('비밀번호를 입력하세요.');
        setLoading(false);
        return;
      }

      // 방 참가
      const joinResponse = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: actualRoomId,
          userId: userName,
          password: password || null
        })
      });

      const joinData = await joinResponse.json();
      
      if (joinData.success) {
        onJoin(actualRoomId, userName);
      } else {
        setError(joinData.message);
      }
    } catch (error) {
      console.error('Join room error:', error);
      setError('방 참가에 실패했습니다.');
    } finally {
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
                placeholder="방 ID 또는 회의 링크를 입력하세요"
                required
                className="form-input"
              />
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
