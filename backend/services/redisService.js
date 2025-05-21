import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis when this module is imported
(async () => {
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  await redisClient.connect();
  console.log('Connected to Redis');
})();

// Helper function to set a value with optional expiration
async function setValue(key, value, expirationInSeconds = null) {
  try {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (expirationInSeconds) {
      await redisClient.set(key, stringValue, { EX: expirationInSeconds });
    } else {
      await redisClient.set(key, stringValue);
    }
    
    return true;
  } catch (error) {
    console.error('Redis setValue error:', error);
    return false;
  }
}

// Helper function to get a value
async function getValue(key) {
  try {
    const value = await redisClient.get(key);
    
    if (!value) return null;
    
    // Try to parse as JSON, if not return as string
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Redis getValue error:', error);
    return null;
  }
}

// Helper function to delete a key
async function deleteKey(key) {
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis deleteKey error:', error);
    return false;
  }
}

export default {
  client: redisClient,
  setValue,
  getValue,
  deleteKey
};