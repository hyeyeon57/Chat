const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, '../data/users.json');

// 사용자 데이터 파일 초기화
const ensureUsersFile = () => {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
};

// 사용자 데이터 읽기
const readUsers = () => {
  ensureUsersFile();
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// 사용자 데이터 쓰기
const writeUsers = (users) => {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

class User {
  static async findByEmail(email) {
    const users = readUsers();
    return users.find(user => user.email === email);
  }

  static async findById(id) {
    const users = readUsers();
    return users.find(user => user.id === id);
  }

  static async findByProviderId(provider, providerId) {
    const users = readUsers();
    return users.find(user => 
      user.provider === provider && user.providerId === providerId
    );
  }

  static async create(userData) {
    const users = readUsers();
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
    writeUsers(users);
    return newUser;
  }

  static async update(id, updates) {
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;
    
    users[userIndex] = {
      ...users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeUsers(users);
    return users[userIndex];
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;

