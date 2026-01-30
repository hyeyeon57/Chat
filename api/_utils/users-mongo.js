// MongoDB 기반 사용자 저장소
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./db');

// 사용자 스키마
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    default: null
  },
  name: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    default: 'local',
    enum: ['local', 'kakao', 'naver', 'google']
  },
  providerId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 인덱스 생성
userSchema.index({ email: 1 });
userSchema.index({ provider: 1, providerId: 1 });

// 모델 생성 (이미 존재하면 재사용)
const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

class User {
  static async findByEmail(email) {
    try {
      await connectDB();
      return await UserModel.findOne({ email: email.toLowerCase() });
    } catch (error) {
      console.error('findByEmail error:', error);
      return null;
    }
  }

  static async findById(id) {
    try {
      await connectDB();
      return await UserModel.findById(id);
    } catch (error) {
      console.error('findById error:', error);
      return null;
    }
  }

  static async findByProviderId(provider, providerId) {
    try {
      await connectDB();
      return await UserModel.findOne({ provider, providerId });
    } catch (error) {
      console.error('findByProviderId error:', error);
      return null;
    }
  }

  static async create(userData) {
    try {
      await connectDB();
      const hashedPassword = userData.password 
        ? await bcrypt.hash(userData.password, 10) 
        : null;
      
      const newUser = new UserModel({
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        name: userData.name,
        provider: userData.provider || 'local',
        providerId: userData.providerId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedUser = await newUser.save();
      // password 필드 제거 후 반환
      const userObj = savedUser.toObject();
      delete userObj.password;
      return userObj;
    } catch (error) {
      console.error('create user error:', error);
      if (error.code === 11000) {
        throw new Error('이미 존재하는 이메일입니다.');
      }
      throw error;
    }
  }

  static async update(id, updates) {
    try {
      await connectDB();
      updates.updatedAt = new Date();
      const updatedUser = await UserModel.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      );
      if (updatedUser) {
        const userObj = updatedUser.toObject();
        delete userObj.password;
        return userObj;
      }
      return null;
    } catch (error) {
      console.error('update user error:', error);
      return null;
    }
  }

  static async comparePassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async findAll() {
    try {
      await connectDB();
      const users = await UserModel.find({}).select('-password').sort({ createdAt: -1 });
      return users;
    } catch (error) {
      console.error('findAll error:', error);
      return [];
    }
  }

  static async count() {
    try {
      await connectDB();
      return await UserModel.countDocuments({});
    } catch (error) {
      console.error('count error:', error);
      return 0;
    }
  }
}

module.exports = User;

