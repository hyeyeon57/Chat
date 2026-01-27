// 메모리 기반 사용자 저장소 (Vercel Serverless Functions용)
// 프로덕션에서는 데이터베이스 사용 권장
const bcrypt = require('bcryptjs');

// 메모리 기반 사용자 저장소
let users = [];

class User {
  static async findByEmail(email) {
    return users.find(user => user.email === email);
  }

  static async findById(id) {
    return users.find(user => user.id === id);
  }

  static async findByProviderId(provider, providerId) {
    return users.find(user => 
      user.provider === provider && user.providerId === providerId
    );
  }

  static async create(userData) {
    const newUser = {
      id: Date.now().toString(),
      email: userData.email,
      password: userData.password ? await bcrypt.hash(userData.password, 10) : null,
      name: userData.name,
      provider: userData.provider || 'local',
      providerId: userData.providerId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    return newUser;
  }

  static async update(id, updates) {
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    
    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return users[userIndex];
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;

