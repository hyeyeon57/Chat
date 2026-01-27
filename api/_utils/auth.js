const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };

