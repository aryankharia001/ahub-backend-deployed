const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create separate directories for various upload types
const watermarkedDir = path.join(uploadDir, 'watermarked');
const finalDir = path.join(uploadDir, 'final');
const contributorDir = path.join(uploadDir, 'contributor');

if (!fs.existsSync(watermarkedDir)) {
  fs.mkdirSync(watermarkedDir, { recursive: true });
}

if (!fs.existsSync(finalDir)) {
  fs.mkdirSync(finalDir, { recursive: true });
}

if (!fs.existsSync(contributorDir)) {
  fs.mkdirSync(contributorDir, { recursive: true });
}

// Set up storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine appropriate directory based on upload type
    let destDir = watermarkedDir; // default

    // Check URL path to determine the type of upload
    if (req.url.includes('/deliver-final')) {
      destDir = finalDir;
    } else if (req.url.includes('/submit-work')) {
      destDir = contributorDir;
    } else if (req.query.type === 'final') {
      destDir = finalDir;
    }

    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${file.fieldname}-${Date.now()}-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter to validate uploads
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'image/svg+xml',
    'text/plain',
    'text/csv',
    'application/json'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Please upload a supported file type.'), false);
  }
};

// Configure multer
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB file size limit
  }
});

// Add simple watermark text to file name for demonstration
// In a real application, you would use image manipulation libraries to add watermarks
const addWatermarkToFileName = (fileName) => {
  const ext = path.extname(fileName);
  const nameWithoutExt = fileName.slice(0, fileName.length - ext.length);
  return `${nameWithoutExt}_watermarked${ext}`;
};

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum file size is 25MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
  
  // No error occurred, continue the chain
  next();
};

module.exports = {
  upload,
  handleUploadError,
  addWatermarkToFileName
};