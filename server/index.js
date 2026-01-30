require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');
const connectDB = require('../api/_utils/db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 인증 라우트
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);

// 정적 파일 제공 (프로덕션용)
app.use(express.static(path.join(__dirname, '../client/build')));

// 방 관리
const rooms = new Map(); // roomId -> { users: Set, password: string, host: string }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 방 생성 (회의 링크 생성)
  socket.on('create-room', (userId, password, callback) => {
    const roomId = Math.random().toString(36).substring(2, 11);
    rooms.set(roomId, {
      users: new Set(),
      password: password || null,
      host: userId,
      createdAt: new Date().toISOString()
    });
    
    console.log(`Room ${roomId} created by ${userId}`);
    callback({ success: true, roomId });
  });

  // 방 참가 (비밀번호 확인)
  socket.on('join-room', (roomId, userId, password, callback) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, message: '방을 찾을 수 없습니다.' });
      return;
    }
    
    // 비밀번호 확인
    if (room.password && room.password !== password) {
      callback({ success: false, message: '비밀번호가 올바르지 않습니다.' });
      return;
    }
    
    socket.join(roomId);
    socket.userId = userId;
    socket.roomId = roomId;
    
    // 이미 방에 있는 사용자들 목록 전송 (현재 사용자 제외)
    const existingUsers = Array.from(room.users).filter(id => id !== userId);
    if (existingUsers.length > 0) {
      socket.emit('existing-users', existingUsers);
    }
    
    // 다른 사용자들에게 새 사용자 참가 알림
    socket.to(roomId).emit('user-joined', userId);
    
    room.users.add(userId);
    
    callback({ success: true });
    console.log(`User ${userId} joined room ${roomId}. Total users: ${room.users.size}`);
  });

  // WebRTC offer 전송
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: data.from
    });
  });

  // WebRTC answer 전송
  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: data.from
    });
  });

  // ICE candidate 전송
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      from: data.from
    });
  });

  // 채팅 메시지
  socket.on('chat-message', (data) => {
    io.to(data.roomId).emit('chat-message', {
      message: data.message,
      userId: data.userId,
      timestamp: new Date().toISOString()
    });
  });

  // 화면 공유 시작
  socket.on('screen-share-start', (data) => {
    socket.to(data.roomId).emit('screen-share-start', {
      userId: data.userId
    });
  });

  // 화면 공유 종료
  socket.on('screen-share-stop', (data) => {
    socket.to(data.roomId).emit('screen-share-stop', {
      userId: data.userId
    });
  });

  // 방 정보 조회
  socket.on('get-room-info', (roomId, callback) => {
    const room = rooms.get(roomId);
    if (room) {
      callback({ 
        success: true, 
        hasPassword: !!room.password,
        userCount: room.users.size 
      });
    } else {
      callback({ success: false, message: '방을 찾을 수 없습니다.' });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // 모든 방에서 사용자 제거
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.userId)) {
        room.users.delete(socket.userId);
        socket.to(roomId).emit('user-left', socket.userId);
        
        // 방에 사용자가 없으면 방 삭제
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (no users)`);
        }
      }
    });
  });
});

// MongoDB 연결 초기화
connectDB().then(() => {
  console.log('MongoDB 연결 준비 완료');
}).catch((err) => {
  console.error('MongoDB 연결 오류:', err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

