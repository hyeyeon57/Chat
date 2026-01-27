import React, { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import './VideoRoom.css';

const PUSHER_KEY = process.env.REACT_APP_PUSHER_KEY || '';
const PUSHER_CLUSTER = process.env.REACT_APP_PUSHER_CLUSTER || 'ap3';

const VideoRoom = ({ roomId, userId, onLeave }) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const peersRef = useRef({});
  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);

  const createPeer = useCallback((targetUserId, isInitiator) => {
    // 이미 peer가 존재하면 생성하지 않음
    if (peersRef.current[targetUserId]) {
      return peersRef.current[targetUserId];
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // 로컬 스트림 추가
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
      });
    }

    // 원격 스트림 처리
    peer.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [targetUserId]: event.streams[0]
      }));
    };

    // ICE candidate 전송 (디바운싱)
    let iceCandidateTimeout = null;
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        // 디바운싱: 100ms마다 한 번만 전송
        if (iceCandidateTimeout) {
          clearTimeout(iceCandidateTimeout);
        }
        iceCandidateTimeout = setTimeout(() => {
          fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: `room-${roomId}`,
              event: 'ice-candidate',
              data: {
                candidate: event.candidate,
                from: userId,
                to: targetUserId
              }
            })
          }).catch(err => console.error('ICE candidate send error:', err));
        }, 100);
      }
    };

    // 연결 상태 처리
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        console.log(`Connection with ${targetUserId} failed or disconnected`);
      }
    };

    peersRef.current[targetUserId] = peer;

    // Offer 생성 (초기화자인 경우)
    if (isInitiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer).then(() => {
          fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: `room-${roomId}`,
              event: 'offer',
              data: {
                offer,
                from: userId,
                to: targetUserId
              }
            })
          });
        }).catch(err => console.error('Error setting local description:', err));
      }).catch(err => console.error('Error creating offer:', err));
    }

    return peer;
  }, [roomId, userId, localStream]);

  // Pusher 초기화 (한 번만 실행)
  useEffect(() => {
    if (!PUSHER_KEY) {
      console.error('Pusher key is not set');
      return;
    }

    // 이미 Pusher가 연결되어 있으면 재생성하지 않음
    if (pusherRef.current) {
      try {
        const state = pusherRef.current.connection.state;
        if (state === 'connected' || state === 'connecting') {
          // 채널만 다시 구독
          if (channelRef.current) {
            pusherRef.current.unsubscribe(`room-${roomId}`);
          }
          channelRef.current = pusherRef.current.subscribe(`room-${roomId}`);
          return;
        }
      } catch (err) {
        // 연결 상태 확인 실패 시 새로 생성
        console.log('Pusher connection check failed, creating new instance');
      }
    }

    // Pusher 연결
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      encrypted: true,
      enabledTransports: ['ws', 'wss'], // WebSocket만 사용
      disableStats: true, // 통계 비활성화로 성능 향상
      forceTLS: true
    });

    // Pusher 연결 상태 모니터링
    pusherRef.current.connection.bind('state_change', (states) => {
      console.log('Pusher connection state:', states.current);
    });

    // 방 채널 구독
    channelRef.current = pusherRef.current.subscribe(`room-${roomId}`);
    
    return () => {
      // Pusher 정리
      if (channelRef.current && pusherRef.current) {
        pusherRef.current.unsubscribe(`room-${roomId}`);
        channelRef.current = null;
      }
      // Pusher는 컴포넌트 언마운트 시에만 disconnect
    };
  }, [roomId]); // roomId만 의존성으로 사용

  // 미디어 스트림 가져오기 (한 번만 실행)
  useEffect(() => {
    if (localStream) return; // 이미 스트림이 있으면 재생성하지 않음

    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    }).then(stream => {
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }).catch(err => {
      console.error('Error accessing media devices:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 방 참가 시 기존 사용자들과 연결 시작
  useEffect(() => {
    if (!localStream || !channelRef.current) return;

    // 방 정보 가져오기
    const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
    fetch(`${API_URL}/api/rooms/info?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.users) {
          console.log('Room info loaded, existing users:', data.users);
          data.users.forEach((existingUserId) => {
            if (existingUserId !== userId && !peersRef.current[existingUserId]) {
              console.log('Connecting to existing user:', existingUserId);
              createPeer(existingUserId, true);
            }
          });
        }
      })
      .catch(err => console.error('Error fetching room info:', err));
  }, [localStream, roomId, userId, createPeer]);

  // Pusher 이벤트 바인딩 (channelRef가 준비된 후)
  useEffect(() => {
    if (!channelRef.current || !pusherRef.current) return;
    
    // 이벤트 핸들러 함수들 정의
    const handleUserJoined = (data) => {
      console.log('User joined event:', data, 'Current userId:', userId);
      
      // 새로 참가한 사용자가 나 자신인 경우 (기존 사용자들에게 연결 시작)
      if (data.userId === userId && data.existingUsers) {
        console.log('I joined, connecting to existing users:', data.existingUsers);
        data.existingUsers.forEach((existingUserId) => {
          if (existingUserId !== userId && !peersRef.current[existingUserId]) {
            console.log('Creating peer for existing user:', existingUserId);
            createPeer(existingUserId, true);
          }
        });
      }
      // 다른 사용자가 참가한 경우 (새 사용자에게 연결 시작)
      else if (data.userId && data.userId !== userId && !peersRef.current[data.userId]) {
        console.log('New user joined, creating peer:', data.userId);
        createPeer(data.userId, true);
      }
      // 기존 사용자 목록이 있는 경우 (백업 로직)
      else if (data.existingUsers) {
        data.existingUsers.forEach((existingUserId) => {
          if (existingUserId !== userId && !peersRef.current[existingUserId]) {
            console.log('Creating peer for existing user (backup):', existingUserId);
            createPeer(existingUserId, true);
          }
        });
      }
    };

    const handleOffer = async ({ offer, from, to }) => {
      // 자신이 보낸 offer이거나, 자신에게 오지 않은 offer는 무시
      if (from === userId || (to && to !== userId)) return;
      
      console.log('Received offer from:', from, 'to:', to || 'all');
      const peer = createPeer(from, false);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      
      fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `room-${roomId}`,
          event: 'answer',
          data: {
            answer,
            from: userId,
            to: from
          }
        })
      }).catch(err => console.error('Answer send error:', err));
    };

    const handleAnswer = async ({ answer, from, to }) => {
      // 자신이 보낸 answer이거나, 자신에게 오지 않은 answer는 무시
      if (from === userId || (to && to !== userId)) return;
      
      console.log('Received answer from:', from, 'to:', to || 'all');
      const peer = peersRef.current[from];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ candidate, from, to }) => {
      // 자신이 보낸 candidate이거나, 자신에게 오지 않은 candidate는 무시
      if (from === userId || (to && to !== userId)) return;
      
      const peer = peersRef.current[from];
      if (peer && candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('ICE candidate add error:', err);
        }
      }
    };

    const handleUserLeft = (leftUserId) => {
      if (peersRef.current[leftUserId]) {
        peersRef.current[leftUserId].close();
        delete peersRef.current[leftUserId];
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[leftUserId];
          return newPeers;
        });
      }
    };

    const handleChatMessage = (data) => {
      setChatMessages(prev => [...prev, data]);
    };

    const handleScreenShareStart = ({ userId: sharingUserId }) => {
      console.log(`User ${sharingUserId} started screen sharing`);
    };

    const handleScreenShareStop = ({ userId: sharingUserId }) => {
      console.log(`User ${sharingUserId} stopped screen sharing`);
    };

    // 이벤트 바인딩
    channelRef.current.bind('user-joined', handleUserJoined);
    channelRef.current.bind('offer', handleOffer);
    channelRef.current.bind('answer', handleAnswer);
    channelRef.current.bind('ice-candidate', handleIceCandidate);
    channelRef.current.bind('user-left', handleUserLeft);
    channelRef.current.bind('chat-message', handleChatMessage);
    channelRef.current.bind('screen-share-start', handleScreenShareStart);
    channelRef.current.bind('screen-share-stop', handleScreenShareStop);

    return () => {
      // Pusher 이벤트 언바인딩
      if (channelRef.current) {
        channelRef.current.unbind('user-joined');
        channelRef.current.unbind('offer');
        channelRef.current.unbind('answer');
        channelRef.current.unbind('ice-candidate');
        channelRef.current.unbind('user-left');
        channelRef.current.unbind('chat-message');
        channelRef.current.unbind('screen-share-start');
        channelRef.current.unbind('screen-share-stop');
      }
    };
  }, [roomId, userId, createPeer]); // createPeer 변경 시에만 이벤트 재바인딩

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      const currentLocalStream = localStream;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const currentPeers = peersRef.current;
      
      if (currentLocalStream) {
        currentLocalStream.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(currentPeers).forEach(peer => peer.close());
      
      // Pusher 최종 정리
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 언마운트 시에만 실행

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        
        // 모든 peer에 화면 스트림 전송
        Object.keys(peersRef.current).forEach(targetUserId => {
          const peer = peersRef.current[targetUserId];
          const sender = peer.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });

        // 로컬 비디오에도 화면 스트림 표시
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: `room-${roomId}`,
            event: 'screen-share-start',
            data: { userId }
          })
        });

        // 화면 공유 종료 감지
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // 원래 비디오 스트림으로 복원
    if (localStream) {
      Object.keys(peersRef.current).forEach(targetUserId => {
        const peer = peersRef.current[targetUserId];
        const sender = peer.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender && localStream.getVideoTracks()[0]) {
          sender.replaceTrack(localStream.getVideoTracks()[0]);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }

    setIsScreenSharing(false);
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: 'screen-share-stop',
        data: { userId }
      })
    });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: `room-${roomId}`,
          event: 'chat-message',
          data: {
            roomId,
            userId,
            message: chatInput.trim(),
            timestamp: new Date().toISOString()
          }
        })
      });
      setChatInput('');
    }
  };

  const handleLeave = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    Object.values(peersRef.current).forEach(peer => peer.close());
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/pusher/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: `room-${roomId}`,
        event: 'user-left',
        data: { userId }
      })
    });
    if (pusherRef.current) {
      pusherRef.current.disconnect();
    }
    onLeave();
  };

  const peerEntries = Object.entries(peers);
  const totalParticipants = 1 + peerEntries.length;

  return (
    <div className="video-room">
      <div className="video-room-header">
        <div className="room-info">
          <h2>방 ID: {roomId}</h2>
          <p>참가자: {totalParticipants}명</p>
        </div>
        <button onClick={handleLeave} className="leave-btn">
          나가기
        </button>
      </div>

      <div className="video-grid">
        <div className="video-container local">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video-element"
          />
          <div className="video-label">{userId} (나)</div>
        </div>

        {peerEntries.map(([peerUserId, stream]) => (
          <div key={peerUserId} className="video-container remote">
            <video
              autoPlay
              playsInline
              className="video-element"
              ref={(videoElement) => {
                if (videoElement && stream) {
                  videoElement.srcObject = stream;
                }
              }}
            />
            <div className="video-label">{peerUserId}</div>
          </div>
        ))}
      </div>

      <div className="controls">
        <button
          onClick={toggleVideo}
          className={`control-btn ${!isVideoOn ? 'disabled' : ''}`}
          title={isVideoOn ? '비디오 끄기' : '비디오 켜기'}
        >
          {isVideoOn ? '📹' : '📵'}
        </button>
        <button
          onClick={toggleAudio}
          className={`control-btn ${!isAudioOn ? 'disabled' : ''}`}
          title={isAudioOn ? '오디오 끄기' : '오디오 켜기'}
        >
          {isAudioOn ? '🎤' : '🔇'}
        </button>
        <button
          onClick={toggleScreenShare}
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          title={isScreenSharing ? '화면 공유 종료' : '화면 공유'}
        >
          {isScreenSharing ? '🖥️' : '📺'}
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          className={`control-btn ${showChat ? 'active' : ''}`}
          title="채팅"
        >
          💬
        </button>
      </div>

      {showChat && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>채팅</h3>
            <button onClick={() => setShowChat(false)} className="close-chat">×</button>
          </div>
          <div className="chat-messages">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.userId === userId ? 'own' : ''}`}>
                <div className="chat-user">{msg.userId}</div>
                <div className="chat-text">{msg.message}</div>
                <div className="chat-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="chat-input-form">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn">전송</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default VideoRoom;
