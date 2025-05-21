import jwt from 'jsonwebtoken';
import redisService from '../services/redisService.js';

const TOKEN_PREFIX = 'token:';

export const authenticateUser = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication failed: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // First check Redis to see if the token is valid
    const tokenKey = `${TOKEN_PREFIX}${token}`;
    const tokenData = await redisService.getValue(tokenKey);
    
    if (!tokenData || !tokenData.valid) {
      return res.status(401).json({ message: 'Authentication failed: Invalid or expired token' });
    }
    
    // If Redis says token is valid, also verify JWT signature as a second check
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-default-secret-key');
      
      // Add user data to request object
      req.userData = { 
        userId: decoded.userId,
        email: decoded.email
      };
      
      // Refresh token expiration in Redis
      await redisService.setValue(tokenKey, tokenData, 24 * 60 * 60); // Reset to 24 hours
      
      next();
    } catch (jwtError) {
      // If JWT verification fails, invalidate token in Redis
      if (tokenData) {
        await redisService.setValue(tokenKey, {
          ...tokenData,
          valid: false,
        }, 3600); // Keep invalid token for 1 hour to prevent reuse
      }
      
      return res.status(401).json({ message: 'Authentication failed: Token invalid' });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};