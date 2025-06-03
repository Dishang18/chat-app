import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

// Create temporary memory storage
const storage = multer.memoryStorage();

// Create multer instance
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Audio file filter
const audioFileFilter = (req, file, cb) => {
  const allowedTypes = /mp3|wav|ogg|m4a|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only audio files are allowed'));
};

// Audio upload instance
const audioUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: audioFileFilter
});

// Create GridFS helper middleware
export const storeInGridFS = async (req, res, next) => {
  if (!req.file) return next();
  
  try {
    // Generate a random filename
    const filename = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
    
    // Connect to GridFS
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
    
    // Create a buffer from the file
    const buffer = req.file.buffer;
    
    // Create upload stream with file ID tracking
    let fileId;
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        uploadedBy: req.user?.id || 'anonymous'
      }
    });
    
    // Store the ID when it's generated
    fileId = uploadStream.id;
    
    // Write the file to GridFS
    uploadStream.write(buffer);
    uploadStream.end();
    
    // Wait for the upload to finish - fixed event handler
    uploadStream.on('finish', () => {
      // Attach file info to request object using the previously stored ID
      req.file.id = fileId;
      req.file.filename = filename;
      next();
    });
    
    uploadStream.on('error', (error) => {
      console.error("GridFS upload error:", error);
      next(error);
    });
  } catch (error) {
    console.error("Error in storeInGridFS:", error);
    next(error);
  }
};

// Export a modified upload middleware
export default {
  single: (fieldName) => [upload.single(fieldName), storeInGridFS],
  audio: {
    single: (fieldName) => [audioUpload.single(fieldName), storeInGridFS]
  }
};