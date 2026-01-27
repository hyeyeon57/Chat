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

    // ICE candidate 전송
    peer.onicecandidate = (event) => {
      if (event.candidate) {
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
        });
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

  useEffect(() => {
    if (!PUSHER_KEY) {
      console.error('Pusher key is not set');
      return;
    }

    // Pusher 연결
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      encrypted: true
    });

    // 방 채널 구독
    channelRef.current = pusherRef.current.subscribe(`room-${roomId}`);
    
    // 미디어 스트림 가져오기
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    }).then(stream => {
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    });

    // 방에 이미 있는 사용자들 받기
    channelRef.current.bind('user-joined', (data) => {
      if (data.existingUsers) {
        data.existingUsers.forEach((existingUserId) => {
          if (existingUserId !== userId && !peersRef.current[existingUserId]) {
            createPeer(existingUserId, true);
          }
        });
      }
      
      if (data.userId && data.userId !== userId && !peersRef.current[data.userId]) {
        createPeer(data.userId, true);
      }
    });

    // Offer 수신
    channelRef.current.bind('offer', async ({ offer, from }) => {
      if (from === userId) return;
      const peer = createPeer(from, false);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      
      // Answer 전송 (API를 통해)
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
      });
    });

    // Answer 수신
    channelRef.current.bind('answer', async ({ answer, from }) => {
      if (from === userId) return;
      const peer = peersRef.current[from];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // ICE candidate 수신
    channelRef.current.bind('ice-candidate', async ({ candidate, from }) => {
      if (from === userId) return;
      const peer = peersRef.current[from];
      if (peer) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // 사용자 나감
    channelRef.current.bind('user-left', (leftUserId) => {
      if (peersRef.current[leftUserId]) {
        peersRef.current[leftUserId].close();
        delete peersRef.current[leftUserId];
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[leftUserId];
          return newPeers;
        });
      }
    });

    // 채팅 메시지 수신
    channelRef.current.bind('chat-message', (data) => {
      setChatMessages(prev => [...prev, data]);
    });

    // 화면 공유 시작
    channelRef.current.bind('screen-share-start', ({ userId: sharingUserId }) => {
      console.log(`User ${sharingUserId} started screen sharing`);
    });

    // 화면 공유 종료
    channelRef.current.bind('screen-share-stop', ({ userId: sharingUserId }) => {
      console.log(`User ${sharingUserId} stopped screen sharing`);
    });

    return () => {
      // 정리
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
      if (channelRef.current) {
        pusherRef.current.unsubscribe(`room-${roomId}`);
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, [roomId, userId, createPeer, localStream]);

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
