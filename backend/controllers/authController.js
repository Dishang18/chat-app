import User from '../models/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import redisService from '../services/redisService.js'; // Import Redis service

// Session expiration time (in seconds)
const SESSION_EXPIRATION = 24 * 60 * 60; // 24 hours
const TOKEN_PREFIX = 'token:';
const SESSION_PREFIX = 'session:';

// Signup controller
export const signup = async (req, res) => {
  try {
    const { username, email, password, preferredLanguage, phone } = req.body;
    
    // Check if user already exists with the email
    const existingUserEmail = await User.findOne({ email });
    if (existingUserEmail) {
      return res.status(400).json({ message: "User already exists with this email" });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken. Please choose a different username." });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      preferredLanguage,
      phone,
      isVerified: true
    });
    
    // Save user to database
    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || 'your-default-secret-key',
      { expiresIn: '24h' }
    );
    
    // Store token in Redis for validation
    await redisService.setValue(`${TOKEN_PREFIX}${token}`, {
      userId: newUser._id.toString(),
      email: newUser.email,
      valid: true,
    }, SESSION_EXPIRATION);
    
    // Store user session data in Redis
    await redisService.setValue(`${SESSION_PREFIX}${newUser._id.toString()}`, {
      userId: newUser._id.toString(),
      username: newUser.username,
      email: newUser.email,
      preferredLanguage: newUser.preferredLanguage,
      lastLogin: new Date().toISOString(),
    }, SESSION_EXPIRATION);
    
    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        preferredLanguage: newUser.preferredLanguage
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    
    // Handle MongoDB duplicate key errors explicitly
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      
      if (field === 'username') {
        return res.status(400).json({ message: `Username "${value}" is already taken` });
      } else if (field === 'email') {
        return res.status(400).json({ message: `Email "${value}" is already registered` });
      } else {
        return res.status(400).json({ message: `${field} "${value}" already exists` });
      }
    }
    
    res.status(500).json({ message: "Server error during signup", error: error.message });
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: "Account not verified" });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-default-secret-key',
      { expiresIn: '24h' }
    );
    
    // Store token in Redis for validation
    await redisService.setValue(`${TOKEN_PREFIX}${token}`, {
      userId: user._id.toString(),
      email: user.email,
      valid: true,
    }, SESSION_EXPIRATION);
    
    // Store or update user session in Redis
    await redisService.setValue(`${SESSION_PREFIX}${user._id.toString()}`, {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      preferredLanguage: user.preferredLanguage,
      lastLogin: new Date().toISOString(),
    }, SESSION_EXPIRATION);
    
    // Record login activity 
    await redisService.client.lPush(`user:${user._id}:logins`, JSON.stringify({
      timestamp: new Date().toISOString(),
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    }));
    // Keep only last 10 logins
    await redisService.client.lTrim(`user:${user._id}:logins`, 0, 9);
    
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        preferredLanguage: user.preferredLanguage
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login", error: error.message });
  }
};

// Logout controller
export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Invalidate token in Redis
      const tokenKey = `${TOKEN_PREFIX}${token}`;
      const tokenData = await redisService.getValue(tokenKey);
      
      if (tokenData && tokenData.userId) {
        // Mark token as invalid but keep it for a while to prevent reuse
        await redisService.setValue(tokenKey, {
          ...tokenData,
          valid: false,
        }, 3600); // Keep invalid token for 1 hour to prevent reuse
      } else {
        // If token not found in Redis, just delete it
        await redisService.deleteKey(tokenKey);
      }
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

