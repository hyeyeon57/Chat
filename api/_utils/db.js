// MongoDB 연결 설정
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || '';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI가 설정되지 않았습니다. 메모리 저장소를 사용합니다.');
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB 연결 성공');
      return mongoose;
    }).catch((err) => {
      console.error('MongoDB 연결 실패:', err);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

module.exports = connectDB;

