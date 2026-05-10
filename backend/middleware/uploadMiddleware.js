const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../utils/cloudinary');

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  'profile-image': 2 * 1024 * 1024, // 2MB
  'document': 5 * 1024 * 1024, // 5MB
  'resume': 10 * 1024 * 1024, // 10MB
  'contract': 10 * 1024 * 1024, // 10MB
};

// Allowed file types
const ALLOWED_FILE_TYPES = {
  'profile-image': ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  'document': ['image/jpeg', 'image/png', 'application/pdf', 'image/jpg', 'image/webp'],
  'resume': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'contract': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// Configure Cloudinary storage
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const category = req.body.category || 'document';
    let folder = 'employees/documents';
    let resource_type = 'auto';
    
    if (category === 'profile-image') {
      folder = 'employees/profiles';
      resource_type = 'image';
    } else if (category === 'resume') {
      folder = 'employees/resumes';
    } else if (category === 'contract') {
      folder = 'employees/contracts';
    } else if (category === 'id-proof') {
      folder = 'employees/id-proofs';
    }
    
    return {
      folder,
      resource_type,
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}_${req.user?.id || 'anonymous'}`,
      transformation: category === 'profile-image' ? [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto' }
      ] : [],
    };
  },
});

// File filter function
const fileFilter = (category) => {
  return (req, file, cb) => {
    const uploadCategory = category || req.body.category || 'document';
    const allowedTypes = ALLOWED_FILE_TYPES[uploadCategory] || ALLOWED_FILE_TYPES.document;
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  };
};

// Configure multer for single file upload
const uploadSingleFile = (fieldName, category = null) => {
  const storage = cloudinaryStorage;
  const filter = fileFilter(category);
  const limits = {
    fileSize: FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.document,
  };
  
  const upload = multer({ storage, fileFilter: filter, limits });
  return upload.single(fieldName);
};

// Configure multer for multiple file upload
const uploadMultipleFiles = (fieldName, maxCount = 5, category = null) => {
  const storage = cloudinaryStorage;
  const filter = fileFilter(category);
  const limits = {
    fileSize: FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.document,
  };
  
  const upload = multer({ storage, fileFilter: filter, limits });
  return upload.array(fieldName, maxCount);
};

// Local storage for development (optional)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const localUpload = multer({ 
  storage: localStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter('document'),
});

module.exports = {
  uploadSingleFile,
  uploadMultipleFiles,
  localUpload,
  FILE_SIZE_LIMITS,
  ALLOWED_FILE_TYPES,
};