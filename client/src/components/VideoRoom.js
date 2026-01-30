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
  const [mediaError, setMediaError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const peersRef = useRef({});
  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const mediaStreamRequested = useRef(false); // 미디어 스트림 요청 플래그
  
  // 고유한 사용자 ID 가져오기 (localStorage에서 가져오거나 새로 생성)
  const getUniqueUserId = () => {
    const saved = localStorage.getItem('currentUniqueUserId');
    if (saved) {
      return saved;
    }
    // 없으면 새로 생성
    const newId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('currentUniqueUserId', newId);
    return newId;
  };
  const uniqueUserId = useRef(getUniqueUserId());

  const createPeer = useCallback((targetUserId, isInitiator) => {
    // 이미 peer가 존재하면 생성하지 않음
    if (peersRef.current[targetUserId]) {
      console.log('Peer already exists for:', targetUserId);
      return peersRef.current[targetUserId];
    }

    // 로컬 스트림이 없으면 생성하지 않음 - CRITICAL: stream이 준비되기 전에는 peer 생성 안 함
    if (!localStream) {
      console.error('❌ CRITICAL: Local stream not ready, cannot create peer for:', targetUserId);
      console.error('   This should not happen - peer creation should only occur after localStream is ready');
      return null;
    }
    
    // localStream의 track 확인 - CRITICAL: video track이 있어야 함
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length === 0) {
      console.error('❌ CRITICAL: No video tracks in localStream when creating peer!');
      console.error('   Tracks:', { video: videoTracks.length, audio: audioTracks.length });
    }

    console.log('Creating peer for:', targetUserId, 'isInitiator:', isInitiator);

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // 로컬 스트림 추가 - 반드시 createOffer/createAnswer 전에 실행되어야 함
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      
      console.log('📹 Adding local tracks to peer:', {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        targetUserId
      });
      
      // Video track 추가 (가장 중요!)
      videoTracks.forEach(track => {
        if (track.readyState === 'live') {
          peer.addTrack(track, localStream);
          console.log('✅ Added VIDEO track to peer:', track.id, 'enabled:', track.enabled, 'label:', track.label);
        } else {
          console.error('❌ Video track not ready:', track.id, 'state:', track.readyState);
        }
      });
      
      // Audio track 추가
      audioTracks.forEach(track => {
        if (track.readyState === 'live') {
          peer.addTrack(track, localStream);
          console.log('✅ Added AUDIO track to peer:', track.id, 'enabled:', track.enabled, 'label:', track.label);
        } else {
          console.error('❌ Audio track not ready:', track.id, 'state:', track.readyState);
        }
      });
      
      // Track 추가 확인 - CRITICAL: 이 로그로 addTrack 성공 여부 확인 가능
      const addedTracks = peer.getSenders().map(sender => sender.track?.kind).filter(Boolean);
      const addedVideoTracks = peer.getSenders().filter(s => s.track?.kind === 'video').length;
      const addedAudioTracks = peer.getSenders().filter(s => s.track?.kind === 'audio').length;
      
      // 진단 로그 (사용자 요청)
      console.log('🔍 DIAGNOSTIC - tracks:', localStream?.getTracks().map(t => t.kind));
      console.log('🔍 DIAGNOSTIC - senders:', peer.getSenders().map(s => s.track?.kind));
      
      console.log('📊 Tracks added to peer:', addedTracks, 'for:', targetUserId);
      console.log('📊 Track counts:', { 
        video: addedVideoTracks, 
        audio: addedAudioTracks,
        total: addedTracks.length 
      });
      
      // CRITICAL: Video track이 없으면 에러
      if (videoTracks.length === 0) {
        console.error('❌ CRITICAL: No video tracks in local stream!');
      } else if (addedVideoTracks === 0) {
        console.error('❌ CRITICAL: Video tracks exist in stream but were not added to peer!');
        console.error('   Stream video tracks:', videoTracks.map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })));
      }
    } else {
      console.error('❌ No local stream available when creating peer for:', targetUserId);
    }

    // 원격 스트림 처리 - 반드시 이 함수가 호출되어야 상대 비디오가 보임
    // CRITICAL: 이 함수가 호출되지 않으면 상대 비디오가 절대 안 보임
    peer.ontrack = (event) => {
      console.log('🎥 === Received track from:', targetUserId, '===');
      console.log('Event streams:', event.streams);
      console.log('Event stream count:', event.streams?.length || 0);
      console.log('Event track:', event.track);
      console.log('Track kind:', event.track?.kind);
      console.log('Track enabled:', event.track?.enabled);
      console.log('Track readyState:', event.track?.readyState);
      console.log('Track id:', event.track?.id);
      console.log('Track label:', event.track?.label);
      console.log('Connection state:', peer.connectionState);
      console.log('ICE connection state:', peer.iceConnectionState);
      
      // Video track인지 확인
      if (event.track?.kind === 'video') {
        console.log('✅✅✅ VIDEO TRACK RECEIVED from:', targetUserId, '- This is CRITICAL!');
      } else if (event.track?.kind === 'audio') {
        console.log('🔊 AUDIO TRACK RECEIVED from:', targetUserId);
      }
      
      let stream = null;
      
      if (event.streams && event.streams.length > 0) {
        stream = event.streams[0];
        console.log('✅ Using stream from event.streams[0], tracks:', stream.getTracks().length);
        console.log('   Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, id: t.id, readyState: t.readyState })));
      } else if (event.track) {
        // streams가 없어도 track이 있으면 스트림 생성
        stream = new MediaStream([event.track]);
        console.log('✅ Created new stream from track, track kind:', event.track.kind);
      }
      
      if (!stream) {
        console.error('❌ CRITICAL: No stream created from ontrack event!');
        return;
      }
      
      if (stream) {
        // track이 활성화되어 있는지 확인하고 강제 활성화
        stream.getTracks().forEach(track => {
          console.log('Processing track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
          // track이 live 상태이면 무조건 활성화
          if (track.readyState === 'live') {
            if (!track.enabled) {
              track.enabled = true;
              console.log('✅ Force enabled track:', track.kind, 'for:', targetUserId);
            }
          } else {
            // track이 아직 live가 아니면 시작될 때까지 대기
            track.onstart = () => {
              console.log('Track started:', track.kind, 'for:', targetUserId);
              track.enabled = true;
              // peers 상태 업데이트하여 리렌더링 유도
              setPeers(prev => {
                const stream = prev[targetUserId];
                if (stream) {
                  return { ...prev };
                }
                return prev;
              });
            };
          }
        });
        
        // 기존 스트림에 track 추가 (같은 스트림인 경우)
        setPeers(prev => {
          const existingStream = prev[targetUserId];
          if (existingStream && existingStream.id === stream.id) {
            // 같은 스트림이면 track만 추가
            const tracks = stream.getTracks();
            tracks.forEach(track => {
              if (!existingStream.getTracks().some(t => t.id === track.id)) {
                existingStream.addTrack(track);
                // track 활성화
                if (track.readyState === 'live' && !track.enabled) {
                  track.enabled = true;
                }
                console.log('Added track to existing stream:', track.kind, 'state:', track.readyState, 'enabled:', track.enabled);
              }
            });
            // 상태 업데이트를 위해 새 객체 반환
            return { ...prev, [targetUserId]: existingStream };
          } else {
            // 새로운 스트림이면 교체
            const newPeers = { ...prev };
            newPeers[targetUserId] = stream;
            console.log('✅ Updated peers with new stream:', Object.keys(newPeers), 'streamId:', stream.id);
            
            // 스트림의 모든 track 상태 확인 및 활성화
            stream.getTracks().forEach(track => {
              console.log('  Track:', track.kind, 'id:', track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
              
              // track이 live 상태이면 강제 활성화
              if (track.readyState === 'live' && !track.enabled) {
                track.enabled = true;
                console.log('  Force enabled track:', track.kind);
              }
              
              track.onstart = () => {
                console.log('Track started:', track.kind, 'for:', targetUserId);
                // track이 시작되면 peers 상태 업데이트하여 리렌더링 유도
                setPeers(prev => ({ ...prev }));
              };
              
              track.onended = () => {
                console.log('Track ended:', track.kind, 'for:', targetUserId);
              };
            });
            
            return newPeers;
          }
        });
      } else {
        console.warn('No stream or track found in event');
      }
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
                from: uniqueUserId.current,
                to: targetUserId
              }
            })
          }).catch(err => console.error('ICE candidate send error:', err));
        }, 100);
      }
    };

    // 연결 상태 처리
    peer.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${targetUserId}:`, peer.connectionState);
      if (peer.connectionState === 'failed') {
        console.error(`❌ Connection with ${targetUserId} failed!`);
        // 연결 실패 시 peer 재생성 시도
        if (peersRef.current[targetUserId]) {
          delete peersRef.current[targetUserId];
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[targetUserId];
            return newPeers;
          });
          // 재연결 시도
          if (localStream) {
            setTimeout(() => {
              console.log('🔄 Attempting to reconnect to:', targetUserId);
              createPeer(targetUserId, true);
            }, 2000);
          }
        }
      } else if (peer.connectionState === 'disconnected') {
        console.log(`⚠️ Connection with ${targetUserId} disconnected`);
      } else if (peer.connectionState === 'connected') {
        console.log(`✅✅✅ Connection with ${targetUserId} established!`);
        
        // CRITICAL: 연결이 완료되었는데 원격 스트림이 없으면 확인
        setTimeout(() => {
          const currentStream = peersRef.current[targetUserId] ? null : (() => {
            const peersState = peersRef.current;
            // peers state에서 찾기
            return Object.values(peersState).find(s => s && s.getVideoTracks().length > 0);
          })();
          
          if (!currentStream) {
            console.warn('⚠️ Connection established but no remote stream found for:', targetUserId);
            console.warn('   This might mean ontrack event did not fire');
            console.warn('   Checking if track will arrive later...');
            
            // 잠시 후 다시 확인
            setTimeout(() => {
              const stream = peersRef.current[targetUserId] ? null : (() => {
                const peersState = peersRef.current;
                return Object.values(peersState).find(s => s && s.getVideoTracks().length > 0);
              })();
              if (!stream) {
                console.error('❌ Still no remote stream after connection established!');
                console.error('   This indicates ontrack event is not firing');
              }
            }, 2000);
          }
          
          // 원격 스트림 강제 업데이트
          setPeers(prev => {
            const stream = prev[targetUserId];
            if (stream) {
              // 스트림의 track 상태 확인 및 강제 활성화
              stream.getTracks().forEach(track => {
                if (track.readyState === 'live' && !track.enabled) {
                  track.enabled = true;
                  console.log('✅ Enabled track:', track.kind, 'for:', targetUserId);
                }
              });
              return { ...prev };
            }
            return prev;
          });
        }, 500);
      }
    };
    
    // ICE 연결 상태 처리
    peer.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${targetUserId}:`, peer.iceConnectionState);
      if (peer.iceConnectionState === 'failed') {
        console.error(`❌ ICE connection with ${targetUserId} failed!`);
        // ICE 실패 시 재협상 시도
        peer.restartIce();
      } else if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
        console.log(`✅ ICE connection with ${targetUserId} ${peer.iceConnectionState}!`);
        // ICE 연결 완료 시 원격 스트림 강제 업데이트
        setTimeout(() => {
          setPeers(prev => {
            const stream = prev[targetUserId];
            if (stream) {
              // 스트림의 track 상태 확인 및 강제 활성화
              stream.getTracks().forEach(track => {
                if (track.readyState === 'live' && !track.enabled) {
                  track.enabled = true;
                  console.log('Enabled track after ICE:', track.kind, 'for:', targetUserId);
                }
              });
              return { ...prev };
            }
            return prev;
          });
        }, 500);
      }
    };
    
    // ICE 수집 상태 처리
    peer.onicegatheringstatechange = () => {
      console.log(`ICE gathering state with ${targetUserId}:`, peer.iceGatheringState);
      if (peer.iceGatheringState === 'complete') {
        console.log(`✅ ICE gathering complete for ${targetUserId}`);
      }
    };

    peersRef.current[targetUserId] = peer;

    // Offer 생성 (초기화자인 경우) - 반드시 addTrack 이후에 실행되어야 함
    if (isInitiator) {
      // addTrack이 완료되었는지 확인
      const senders = peer.getSenders();
      const hasVideoTrack = senders.some(sender => sender.track?.kind === 'video');
      const hasAudioTrack = senders.some(sender => sender.track?.kind === 'audio');
      
      console.log('📤 Creating offer for:', targetUserId, {
        hasVideoTrack,
        hasAudioTrack,
        senderCount: senders.length
      });
      
      if (!hasVideoTrack) {
        console.error('❌ CRITICAL: No video track added before creating offer!');
      }
      
      // 약간의 지연을 두어 peer가 완전히 준비되도록 함
      setTimeout(() => {
        // CRITICAL: createOffer 전에 다시 한 번 확인
        const finalSenders = peer.getSenders();
        const finalHasVideo = finalSenders.some(s => s.track?.kind === 'video');
        const finalHasAudio = finalSenders.some(s => s.track?.kind === 'audio');
        
        console.log('🔍 Final check before createOffer:', {
          hasVideo: finalHasVideo,
          hasAudio: finalHasAudio,
          senderCount: finalSenders.length,
          trackKinds: finalSenders.map(s => s.track?.kind).filter(Boolean)
        });
        
        if (!finalHasVideo) {
          console.error('❌ CRITICAL: Still no video track before createOffer!');
          console.error('   This will result in SDP without m=video');
          return; // Video track이 없으면 offer 생성 안 함
        }
        
        peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        }).then(offer => {
          console.log('✅ Created offer for:', targetUserId, 'type:', offer.type);
          // SDP에 video가 있는지 확인 - CRITICAL
          const hasVideoInSDP = offer.sdp?.includes('m=video');
          const hasAudioInSDP = offer.sdp?.includes('m=audio');
          console.log('📋 Offer SDP check:', { hasVideoInSDP, hasAudioInSDP });
          if (!hasVideoInSDP) {
            console.error('❌ CRITICAL: No m=video in SDP! This offer will not work for video.');
            console.error('   SDP preview:', offer.sdp?.substring(0, 500));
          }
          return peer.setLocalDescription(offer);
        }).then(() => {
          console.log('📤 Sending offer to:', targetUserId);
          const offer = peer.localDescription;
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
                from: uniqueUserId.current,
                to: targetUserId
              }
            })
          }).catch(err => console.error('Error sending offer:', err));
        }).catch(err => {
          console.error('Error creating/sending offer:', err);
          // 실패 시 재시도
          setTimeout(() => {
            if (peersRef.current[targetUserId] === peer && localStream) {
              console.log('Retrying offer creation for:', targetUserId);
              peer.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              }).then(offer => {
                return peer.setLocalDescription(offer);
              }).then(() => {
                const offer = peer.localDescription;
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
                      from: uniqueUserId.current,
                      to: targetUserId
                    }
                  })
                }).catch(err => console.error('Error sending offer (retry):', err));
              }).catch(err => console.error('Error creating offer (retry):', err));
            }
          }, 1000);
        });
      }, 300);
    }

    return peer;
  }, [roomId, localStream]); // userId 제거 (사용하지 않음)

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
      // 연결이 끊어졌다가 다시 연결되면 재연결 시도하지 않음 (자동 재연결됨)
      if (states.current === 'disconnected' && states.previous === 'connected') {
        console.log('Pusher disconnected, will auto-reconnect...');
      }
    });
    
    // 연결 에러 처리
    pusherRef.current.connection.bind('error', (err) => {
      console.error('Pusher connection error:', err);
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

  // 미디어 스트림 가져오기 함수
  const getMediaStream = useCallback(async (retryCount = 0) => {
    try {
      setMediaError(null);
      
      // 기존 스트림이 있으면 먼저 정리
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped existing track:', track.kind);
        });
        setLocalStream(null);
      }
      
      // 약간의 지연 후 재시도 (디바이스가 해제될 시간을 줌)
      if (retryCount > 0) {
        console.log(`Waiting ${retryCount * 2} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
      
      console.log(`Attempting to get media stream (attempt ${retryCount + 1})...`);
      
      // 먼저 간단한 제약으로 시도 (같은 디바이스에서도 작동하도록)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      } catch (firstError) {
        // 첫 시도 실패 시 더 간단한 제약으로 재시도
        if (firstError.name === 'NotReadableError' || firstError.name === 'OverconstrainedError') {
          console.log('Retrying with simpler constraints...');
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          });
        } else {
          throw firstError;
        }
      }
      
      // 비디오 트랙 상태 확인 - CRITICAL: Video track이 있어야 상대방에게 전송됨
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      console.log('✅ Stream obtained - Video tracks:', videoTracks.length, 'Audio tracks:', audioTracks.length);
      
      // CRITICAL: Video track이 있는지 확인
      if (videoTracks.length === 0) {
        console.error('❌ CRITICAL ERROR: No video tracks in stream! Camera may not be working.');
      } else {
        videoTracks.forEach(track => {
          console.log('✅ Video track:', track.id, 'label:', track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
          track.onended = () => console.log('Video track ended');
        });
      }
      
      if (audioTracks.length === 0) {
        console.warn('⚠️ No audio tracks in stream');
      } else {
        audioTracks.forEach(track => {
          console.log('✅ Audio track:', track.id, 'label:', track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
          track.onended = () => console.log('Audio track ended');
        });
      }
      
      setLocalStream(stream);
      
      // 비디오 요소에 스트림 설정 (약간의 지연을 두어 DOM이 준비되도록)
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('✅ Video srcObject set');
          
          // 재생 시도
          localVideoRef.current.play().then(() => {
            console.log('✅ Local video playing');
          }).catch(err => {
            console.error('❌ Error playing local video:', err);
          });
        } else {
          console.warn('localVideoRef.current is null');
        }
      }, 100);
      
      setMediaError(null);
      setIsRetrying(false);
      mediaStreamRequested.current = true;
      console.log('✅ Media stream obtained and configured successfully');
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setMediaError(err);
      
      // NotReadableError인 경우 - 카메라가 다른 곳에서 사용 중
      if (err.name === 'NotReadableError' || err.message?.includes('Could not start video source')) {
        console.warn('⚠️ Camera is in use by another application or browser tab');
        console.warn('💡 Tip: If testing with two tabs, use different browsers (Chrome + Edge)');
        
        // 재시도 로직 (최대 3번, 점진적으로 대기 시간 증가)
        if (retryCount < 3) {
          const waitTime = (retryCount + 1) * 3; // 3초, 6초, 9초
          console.log(`⏳ Camera in use, will retry in ${waitTime} seconds... (attempt ${retryCount + 1}/3)`);
          setIsRetrying(true);
          setTimeout(() => {
            getMediaStream(retryCount + 1);
          }, waitTime * 1000);
          return null;
        }
        
        // 최종 실패 시 오디오만 시도
        console.log('📹 Video failed after retries, trying audio only as fallback...');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
          });
          setLocalStream(audioStream);
          setMediaError({ 
            ...err, 
            name: err.name,
            message: '카메라를 사용할 수 없습니다.\n\n💡 해결 방법:\n1. 다른 브라우저 사용 (Chrome + Edge 또는 Chrome + Firefox)\n2. 다른 탭에서 카메라를 사용하는 페이지 닫기\n3. 다른 앱에서 카메라 사용 중인지 확인\n\n현재는 오디오만 활성화되었습니다.' 
          });
          console.log('✅ Audio stream obtained (video failed)');
          return audioStream;
        } catch (audioErr) {
          console.error('❌ Audio also failed:', audioErr);
          setMediaError({ 
            ...err, 
            name: err.name,
            message: '카메라와 마이크 모두 사용할 수 없습니다.\n\n💡 해결 방법:\n1. 다른 브라우저 사용 (Chrome + Edge 또는 Chrome + Firefox)\n2. 다른 탭에서 카메라/마이크를 사용하는 페이지 닫기\n3. 다른 앱에서 카메라/마이크 사용 중인지 확인\n4. 브라우저를 완전히 종료 후 다시 시작' 
          });
        }
      } else if (err.name === 'NotAllowedError' || err.message?.includes('Permission dismissed')) {
        // 권한 거부 시 플래그 리셋하여 재시도 가능하게
        mediaStreamRequested.current = false;
        setMediaError({ 
          ...err, 
          message: '카메라/마이크 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘을 클릭하여 권한을 허용한 후 "다시 시도" 버튼을 클릭해주세요.' 
        });
      } else if (err.name === 'NotFoundError') {
        mediaStreamRequested.current = false;
        setMediaError({ ...err, message: '카메라나 마이크를 찾을 수 없습니다.' });
      } else {
        mediaStreamRequested.current = false;
        setMediaError({ ...err, message: err.message || '미디어 디바이스에 접근할 수 없습니다.' });
      }
      
      return null;
    }
  }, [localStream]);

  // 미디어 스트림 가져오기 (한 번만 실행)
  useEffect(() => {
    if (localStream || mediaStreamRequested.current) return; // 이미 스트림이 있거나 요청 중이면 재생성하지 않음
    
    mediaStreamRequested.current = true;
    getMediaStream(0);
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
          console.log('Room info loaded, existing users:', data.users, 'my uniqueUserId:', uniqueUserId.current);
          // 약간의 지연을 두어 Pusher 연결이 완전히 준비되도록 함
          setTimeout(() => {
            data.users.forEach((existingUserId) => {
              // userId로 시작하는 경우와 uniqueUserId를 모두 확인
              const isMe = existingUserId === uniqueUserId.current || 
                          existingUserId === userId ||
                          existingUserId.startsWith(`${userId}_`);
              
              if (!isMe && !peersRef.current[existingUserId]) {
                console.log('Connecting to existing user:', existingUserId);
                createPeer(existingUserId, true);
              }
            });
          }, 1000);
        }
      })
      .catch(err => console.error('Error fetching room info:', err));
  }, [localStream, roomId, userId, createPeer]);

  // Pusher 이벤트 바인딩 (channelRef가 준비된 후)
  useEffect(() => {
    if (!channelRef.current || !pusherRef.current) return;
    
    // 이벤트 핸들러 함수들 정의
    const handleUserJoined = (data) => {
      console.log('User joined event:', data, 'Current uniqueUserId:', uniqueUserId.current);
      
      // 참가자 수 업데이트 - 여러 방법으로 확인
      if (data.userCount !== undefined && data.userCount !== null) {
        setParticipantCount(data.userCount);
        console.log('✅ Updated participant count to:', data.userCount, 'from userCount');
      } else if (data.allUsers && Array.isArray(data.allUsers)) {
        // userCount가 없어도 allUsers로 계산
        setParticipantCount(data.allUsers.length);
        console.log('✅ Updated participant count to:', data.allUsers.length, 'from allUsers');
      } else if (data.existingUsers && Array.isArray(data.existingUsers)) {
        // existingUsers가 있으면 +1 (나 자신 포함)
        setParticipantCount(data.existingUsers.length + 1);
        console.log('✅ Updated participant count to:', data.existingUsers.length + 1, 'from existingUsers + 1');
      }
      
      // 다른 사용자가 참가한 경우 (새 사용자에게 연결 시작)
      if (data.userId && data.userId !== uniqueUserId.current && !peersRef.current[data.userId]) {
        console.log('👤 New user joined, creating peer:', data.userId);
        // 로컬 스트림이 준비되어 있을 때만 연결 시작
        if (localStream) {
          console.log('✅ Local stream ready, creating peer connection');
          setTimeout(() => {
            createPeer(data.userId, true);
          }, 300);
        } else {
          console.warn('⚠️ Local stream not ready yet, will retry when stream is available');
          // localStream이 준비되면 자동으로 연결되도록 대기
          const checkStream = setInterval(() => {
            if (localStream && !peersRef.current[data.userId]) {
              console.log('✅ Local stream now ready, creating peer connection');
              clearInterval(checkStream);
              createPeer(data.userId, true);
            }
          }, 500);
          // 10초 후 타임아웃
          setTimeout(() => clearInterval(checkStream), 10000);
        }
      }
      // 새로 참가한 사용자가 나 자신인 경우 (기존 사용자들에게 연결 시작)
      else if (data.userId === uniqueUserId.current && data.existingUsers) {
        console.log('👤 I joined, connecting to existing users:', data.existingUsers);
        if (localStream) {
          console.log('✅ Local stream ready, creating peer connections to existing users');
          setTimeout(() => {
            data.existingUsers.forEach((existingUserId) => {
              if (existingUserId !== uniqueUserId.current && !peersRef.current[existingUserId]) {
                console.log('🔗 Creating peer for existing user:', existingUserId);
                createPeer(existingUserId, true);
              }
            });
          }, 500);
        } else {
          console.warn('⚠️ Local stream not ready yet, will retry when stream is available');
          // localStream이 준비되면 자동으로 연결되도록 대기
          const checkStream = setInterval(() => {
            if (localStream) {
              console.log('✅ Local stream now ready, creating peer connections to existing users');
              clearInterval(checkStream);
              data.existingUsers.forEach((existingUserId) => {
                if (existingUserId !== uniqueUserId.current && !peersRef.current[existingUserId]) {
                  console.log('🔗 Creating peer for existing user:', existingUserId);
                  createPeer(existingUserId, true);
                }
              });
            }
          }, 500);
          // 10초 후 타임아웃
          setTimeout(() => clearInterval(checkStream), 10000);
        }
      }
      // 기존 사용자 목록이 있는 경우 (백업 로직)
      else if (data.existingUsers && Array.isArray(data.existingUsers) && data.existingUsers.length > 0) {
        console.log('👥 Found existing users (backup):', data.existingUsers);
        if (localStream) {
          setTimeout(() => {
            data.existingUsers.forEach((existingUserId) => {
              if (existingUserId !== uniqueUserId.current && !peersRef.current[existingUserId]) {
                console.log('🔗 Creating peer for existing user (backup):', existingUserId);
                createPeer(existingUserId, true);
              }
            });
          }, 500);
        } else {
          console.warn('⚠️ Local stream not ready yet, will retry when stream is available');
          // localStream이 준비되면 자동으로 연결되도록 대기
          const checkStream = setInterval(() => {
            if (localStream) {
              console.log('✅ Local stream now ready, creating peer connections (backup)');
              clearInterval(checkStream);
              data.existingUsers.forEach((existingUserId) => {
                if (existingUserId !== uniqueUserId.current && !peersRef.current[existingUserId]) {
                  console.log('🔗 Creating peer for existing user (backup):', existingUserId);
                  createPeer(existingUserId, true);
                }
              });
            }
          }, 500);
          // 10초 후 타임아웃
          setTimeout(() => clearInterval(checkStream), 10000);
        }
      }
    };

    const handleOffer = async ({ offer, from, to }) => {
      // 자신이 보낸 offer이거나, 자신에게 오지 않은 offer는 무시
      if (from === uniqueUserId.current || (to && to !== uniqueUserId.current)) {
        console.log('Ignoring offer - from:', from, 'to:', to, 'my uniqueUserId:', uniqueUserId.current);
        return;
      }
      
      console.log('📥 Received offer from:', from, 'to:', to || 'all');
      
      if (!localStream) {
        console.error('❌ Local stream not ready, cannot handle offer');
        return;
      }
      
      // localStream의 track 확인
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      console.log('📹 Local stream tracks before creating peer:', {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length
      });
      
      const peer = createPeer(from, false);
      if (!peer) {
        console.error('❌ Failed to create peer for offer');
        return;
      }
      
      // addTrack이 완료되었는지 확인
      const senders = peer.getSenders();
      const hasVideoTrack = senders.some(sender => sender.track?.kind === 'video');
      console.log('📊 Peer senders after createPeer:', {
        senderCount: senders.length,
        hasVideoTrack,
        trackKinds: senders.map(s => s.track?.kind).filter(Boolean)
      });
      
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('✅ Set remote description for:', from);
        const answer = await peer.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peer.setLocalDescription(answer);
        console.log('✅ Created and set answer for:', from, 'type:', answer.type);
        
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
              from: uniqueUserId.current,
              to: from
            }
          })
        }).catch(err => console.error('Answer send error:', err));
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

    const handleAnswer = async ({ answer, from, to }) => {
      // 자신이 보낸 answer이거나, 자신에게 오지 않은 answer는 무시
      if (from === uniqueUserId.current || (to && to !== uniqueUserId.current)) {
        console.log('Ignoring answer - from:', from, 'to:', to, 'my uniqueUserId:', uniqueUserId.current);
        return;
      }
      
      console.log('Received answer from:', from, 'to:', to || 'all');
      const peer = peersRef.current[from];
      if (peer) {
        try {
          // 현재 상태 확인
          if (peer.signalingState === 'have-local-offer' || peer.signalingState === 'stable') {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('✅ Set remote description (answer) for:', from, 'signalingState:', peer.signalingState);
          } else {
            console.warn('⚠️ Cannot set remote description, signalingState:', peer.signalingState, 'for:', from);
            // 상태가 맞지 않으면 잠시 후 재시도
            setTimeout(async () => {
              if (peersRef.current[from] === peer) {
                try {
                  await peer.setRemoteDescription(new RTCSessionDescription(answer));
                  console.log('✅ Set remote description (answer) after retry for:', from);
                } catch (err) {
                  console.error('❌ Error setting remote description (answer) after retry:', err);
                }
              }
            }, 500);
          }
        } catch (err) {
          console.error('❌ Error setting remote description (answer):', err);
          // 에러 발생 시 재시도
          setTimeout(async () => {
            if (peersRef.current[from] === peer) {
              try {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('✅ Set remote description (answer) after error retry for:', from);
              } catch (retryErr) {
                console.error('❌ Error setting remote description (answer) after error retry:', retryErr);
              }
            }
          }, 1000);
        }
      } else {
        console.warn('Peer not found for answer from:', from);
      }
    };

    const handleIceCandidate = async ({ candidate, from, to }) => {
      // 자신이 보낸 candidate이거나, 자신에게 오지 않은 candidate는 무시
      if (from === uniqueUserId.current || (to && to !== uniqueUserId.current)) {
        return;
      }
      
      const peer = peersRef.current[from];
      if (peer && candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('✅ Added ICE candidate from:', from);
        } catch (err) {
          // 이미 추가된 candidate이면 무시
          if (err.name !== 'OperationError') {
            console.error('❌ ICE candidate add error:', err);
          }
        }
      } else if (!peer) {
        console.warn('Peer not found for ICE candidate from:', from);
      }
    };

    const handleUserLeft = (data) => {
      const leftUserId = typeof data === 'string' ? data : data.userId;
      const userCount = typeof data === 'object' && data.userCount !== undefined ? data.userCount : null;
      
      console.log('User left:', leftUserId, 'Remaining count:', userCount, 'allUsers:', data.allUsers);
      
      // 참가자 수 업데이트 (서버에서 받은 값으로 업데이트)
      if (userCount !== null && userCount !== undefined) {
        setParticipantCount(userCount);
        console.log('✅ Updated participant count to:', userCount);
      } else if (data.allUsers && Array.isArray(data.allUsers)) {
        // userCount가 없어도 allUsers로 계산
        setParticipantCount(data.allUsers.length);
        console.log('✅ Updated participant count from allUsers:', data.allUsers.length);
      } else {
        // 서버에서 카운트를 보내지 않으면 현재 카운트에서 1 감소
        setParticipantCount(prev => Math.max(1, prev - 1));
        console.log('⚠️ Using fallback count calculation');
      }
      
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
  }, [roomId, userId, createPeer, localStream]); // localStream 추가 - stream 준비 후 이벤트 핸들러가 올바른 localStream 참조

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
        console.log('Video toggled:', videoTrack.enabled);
      } else {
        console.warn('No video track found');
      }
    } else {
      console.warn('No local stream available');
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
        console.log('Audio toggled:', audioTrack.enabled);
      } else {
        console.warn('No audio track found');
      }
    } else {
      console.warn('No local stream available');
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        });
        
        screenStreamRef.current = screenStream;
        
        // 모든 peer에 화면 스트림 전송
        Object.keys(peersRef.current).forEach(targetUserId => {
          const peer = peersRef.current[targetUserId];
          const sender = peer.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender && screenStream.getVideoTracks()[0]) {
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
            data: { userId: uniqueUserId.current }
          })
        });

        // 화면 공유 종료 감지
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
        
        // 오디오 트랙 종료 감지
        screenStream.getAudioTracks().forEach(track => {
          track.onended = () => {
            console.log('Screen share audio track ended');
          };
        });
        
        console.log('✅ Screen sharing started');
      } catch (err) {
        console.error('Error sharing screen:', err);
        
        // 에러 타입에 따른 처리
        if (err.name === 'NotAllowedError') {
          alert('화면 공유 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        } else if (err.name === 'NotFoundError') {
          alert('화면 공유 기능을 사용할 수 없습니다.');
        } else if (err.name === 'NotReadableError') {
          alert('화면 공유를 시작할 수 없습니다. 다른 애플리케이션에서 사용 중일 수 있습니다.');
        } else {
          alert('화면 공유 중 오류가 발생했습니다: ' + err.message);
        }
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
        data: { userId: uniqueUserId.current }
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
              userId: uniqueUserId.current,
              message: chatInput.trim(),
              timestamp: new Date().toISOString()
            }
        })
      });
      setChatInput('');
    }
  };

  const handleLeave = async () => {
    console.log('Leaving room:', roomId, 'userId:', uniqueUserId.current);
    
    // 먼저 서버에서 사용자 제거 (이것이 참가자 수를 업데이트함)
    try {
      const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
      const leaveResponse = await fetch(`${API_URL}/api/rooms/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId: uniqueUserId.current
        })
      });
      
      const leaveData = await leaveResponse.json();
      console.log('Leave room response:', leaveData);
    } catch (err) {
      console.error('Error leaving room:', err);
    }
    
    // 미디어 스트림 정리
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // WebRTC 연결 정리
    Object.values(peersRef.current).forEach(peer => peer.close());
    peersRef.current = {};
    setPeers({});
    
    // Pusher 연결 해제
    if (pusherRef.current) {
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
    
    // localStorage 정리
    localStorage.removeItem('currentUniqueUserId');
    
    // 컴포넌트 나가기
    onLeave();
  };

  const peerEntries = Object.entries(peers);
  // 방 정보에서 실제 참가자 수 가져오기
  const [participantCount, setParticipantCount] = useState(1);
  
  // 원격 비디오 요소들을 추적하기 위한 ref
  const remoteVideoRefs = useRef({});
  
  // peers가 변경될 때마다 원격 비디오 요소 강제 업데이트
  useEffect(() => {
    Object.entries(peers).forEach(([peerUserId, stream]) => {
      const videoElement = remoteVideoRefs.current[peerUserId];
      if (videoElement && stream && stream.getVideoTracks().length > 0) {
        if (videoElement.srcObject !== stream) {
          console.log('Force updating video srcObject for:', peerUserId);
          videoElement.srcObject = stream;
        }
        
        // 스트림의 track이 활성화되어 있는지 확인하고 강제 활성화
        stream.getVideoTracks().forEach(track => {
          if (track.readyState === 'live' && !track.enabled) {
            track.enabled = true;
            console.log('Force enabled track in useEffect:', track.kind, 'for:', peerUserId);
          }
        });
        
        // 비디오 재생 시도
        const attemptPlay = () => {
          if (videoElement.srcObject && videoElement.srcObject.getVideoTracks().length > 0) {
            const videoTrack = videoElement.srcObject.getVideoTracks()[0];
            if (videoTrack && videoTrack.readyState === 'live' && videoTrack.enabled) {
              videoElement.play().then(() => {
                console.log('✅ Video playing after useEffect update for:', peerUserId);
              }).catch(err => {
                console.error('❌ Error playing video after useEffect update:', err);
              });
            }
          }
        };
        
        // 즉시 시도
        attemptPlay();
        // 약간의 지연 후 재시도
        setTimeout(attemptPlay, 500);
        setTimeout(attemptPlay, 1000);
      }
    });
  }, [peers]);
  
  // 참가자 수 업데이트 (주기적으로 서버에서 가져오기)
  useEffect(() => {
    const updateParticipantCount = () => {
      if (!roomId) return;
      
      const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
      fetch(`${API_URL}/api/rooms/info?roomId=${roomId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // userCount가 있으면 사용, 없으면 users 배열 길이 사용
            const count = data.userCount !== undefined && data.userCount !== null 
              ? data.userCount 
              : (data.users && Array.isArray(data.users) ? data.users.length : 1);
            setParticipantCount(count);
            console.log('📊 Updated participant count from server:', count, 'users:', data.users?.length);
          }
        })
        .catch(err => console.error('Error fetching participant count:', err));
    };
    
    // 즉시 한 번 실행
    updateParticipantCount();
    // 1초마다 업데이트 (더 자주 동기화)
    const interval = setInterval(updateParticipantCount, 1000);
    return () => clearInterval(interval);
  }, [roomId]);
  
  const totalParticipants = participantCount;

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
          {mediaError && !localStream ? (
            <div className="media-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{mediaError.message || '카메라/마이크에 접근할 수 없습니다.'}</div>
              {isRetrying ? (
                <div className="retry-status">재시도 중...</div>
              ) : (
                <button 
                  onClick={() => {
                    mediaStreamRequested.current = false; // 플래그 리셋
                    setIsRetrying(true);
                    setMediaError(null);
                    getMediaStream(0);
                  }}
                  className="retry-button"
                >
                  다시 시도
                </button>
              )}
            </div>
          ) : localStream ? (
            <video
              ref={(videoElement) => {
                localVideoRef.current = videoElement;
                if (videoElement && localStream) {
                  if (videoElement.srcObject !== localStream) {
                    videoElement.srcObject = localStream;
                    console.log('✅ Video element srcObject set via ref');
                  }
                  // 여러 이벤트에서 재생 시도
                  const playVideo = () => {
                    videoElement.play().then(() => {
                      console.log('✅ Local video playing via ref');
                    }).catch(err => {
                      console.error('❌ Error playing local video:', err);
                    });
                  };
                  videoElement.onloadedmetadata = playVideo;
                  videoElement.oncanplay = playVideo;
                  if (videoElement.readyState >= 2) {
                    playVideo();
                  }
                }
              }}
              autoPlay
              muted
              playsInline
              className="video-element"
            />
          ) : (
            <div className="media-error">
              <div className="error-icon">📹</div>
              <div className="error-message">웹캠을 준비하는 중...</div>
            </div>
          )}
          <div className="video-label">
            {userId} (나)
            {!localStream && !mediaError && ' (연결 중...)'}
          </div>
        </div>

        {peerEntries.map(([peerUserId, stream]) => {
          const videoTracks = stream?.getVideoTracks() || [];
          const audioTracks = stream?.getAudioTracks() || [];
          const activeVideoTracks = videoTracks.filter(t => t.readyState === 'live');
          
          console.log('Rendering peer video:', peerUserId, {
            streamId: stream?.id,
            videoTracks: videoTracks.length,
            activeVideoTracks: activeVideoTracks.length,
            audioTracks: audioTracks.length,
            streamActive: stream && stream.active
          });
          
          return (
            <div key={peerUserId} className="video-container remote">
              {stream && stream.getVideoTracks().length > 0 ? (
                <video
                  autoPlay
                  playsInline
                  muted={false}
                  className="video-element"
                  ref={(videoElement) => {
                    // ref 저장
                    if (videoElement) {
                      remoteVideoRefs.current[peerUserId] = videoElement;
                    } else {
                      delete remoteVideoRefs.current[peerUserId];
                    }
                    if (!videoElement) return;
                    
                    // 스트림이 있으면 항상 설정 (스트림이 업데이트될 수 있음)
                    if (stream) {
                      // srcObject가 다르거나 null이면 설정
                      if (videoElement.srcObject !== stream) {
                        console.log('Setting video srcObject for:', peerUserId, 'tracks:', stream.getTracks().length);
                        videoElement.srcObject = stream;
                      }
                      
                      // 스트림이 변경될 때마다 재생 시도
                      const playVideo = () => {
                        if (videoElement.srcObject && videoElement.srcObject.getVideoTracks().length > 0) {
                          const videoTrack = videoElement.srcObject.getVideoTracks()[0];
                          
                          // track이 비활성화되어 있으면 강제 활성화
                          if (videoTrack && videoTrack.readyState === 'live' && !videoTrack.enabled) {
                            console.log('Force enabling video track for:', peerUserId);
                            videoTrack.enabled = true;
                          }
                          
                          if (videoTrack && videoTrack.readyState === 'live') {
                            console.log('Attempting to play video for:', peerUserId, 'track state:', videoTrack.readyState, 'enabled:', videoTrack.enabled);
                            
                            // 여러 번 재생 시도 (일부 브라우저에서 필요)
                            const attemptPlay = (retries = 0) => {
                              videoElement.play().then(() => {
                                console.log('✅ Video playing for:', peerUserId);
                              }).catch(err => {
                                console.error('❌ Error playing video for', peerUserId, ':', err, 'retry:', retries);
                                if (retries < 3) {
                                  setTimeout(() => attemptPlay(retries + 1), 500);
                                }
                              });
                            };
                            
                            attemptPlay();
                          } else {
                            console.log('Video track not ready for:', peerUserId, 'state:', videoTrack?.readyState);
                            // track이 준비될 때까지 대기
                            if (videoTrack) {
                              videoTrack.onstart = () => {
                                console.log('Video track started for:', peerUserId);
                                playVideo();
                              };
                              // track 상태 변경 감지
                              const checkTrack = setInterval(() => {
                                if (videoTrack.readyState === 'live') {
                                  clearInterval(checkTrack);
                                  playVideo();
                                }
                              }, 200);
                              // 5초 후 타임아웃
                              setTimeout(() => clearInterval(checkTrack), 5000);
                            }
                          }
                        }
                      };
                      
                      // 여러 이벤트에서 재생 시도
                      videoElement.onloadedmetadata = () => {
                        console.log('Video metadata loaded for:', peerUserId);
                        playVideo();
                      };
                      
                      videoElement.oncanplay = () => {
                        console.log('Video can play for:', peerUserId);
                        playVideo();
                      };
                      
                      videoElement.onloadeddata = () => {
                        console.log('Video data loaded for:', peerUserId);
                        playVideo();
                      };
                      
                      // 즉시 재생 시도
                      if (videoElement.readyState >= 2) {
                        playVideo();
                      } else {
                        // readyState가 낮으면 잠시 후 재시도
                        setTimeout(playVideo, 100);
                      }
                      
                      // track 상태 변경 감지
                      stream.getVideoTracks().forEach(track => {
                        track.onended = () => {
                          console.log('Video track ended for:', peerUserId);
                        };
                        track.onmute = () => {
                          console.log('Video track muted for:', peerUserId);
                        };
                        track.onunmute = () => {
                          console.log('Video track unmuted for:', peerUserId);
                          playVideo();
                        };
                      });
                    } else {
                      console.log('No stream for:', peerUserId);
                      videoElement.srcObject = null;
                    }
                  }}
                />
              ) : (
                <div className="media-error">
                  <div className="error-icon">📹</div>
                  <div className="error-message">비디오 스트림 대기 중...</div>
                </div>
              )}
              <div className="video-label">
                {peerUserId}
                {activeVideoTracks.length === 0 && stream && ' (연결 중...)'}
                {!stream && ' (스트림 없음)'}
              </div>
            </div>
          );
        })}
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
              <div key={idx} className={`chat-message ${msg.userId === uniqueUserId.current ? 'own' : ''}`}>
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

