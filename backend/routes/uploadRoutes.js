const express = require('express');
const router = express.Router();
const {
  uploadProfileImage,
  uploadDocument,
  uploadMultipleDocuments,
  getMyDocuments,
  getEmployeeDocuments,
  getDocumentById,
  downloadDocument,
  deleteDocument,
  getUploadStats,
} = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingleFile, uploadMultipleFiles } = require('../middleware/uploadMiddleware');

// All routes are protected
router.use(protect);

// Upload routes
router.post(
  '/profile-image',
  uploadSingleFile('image', 'profile-image'),
  uploadProfileImage
);

router.post(
  '/document',
  uploadSingleFile('document', 'document'),
  uploadDocument
);

router.post(
  '/documents/bulk',
  authorize('admin', 'hr'),
  uploadMultipleFiles('documents', 10, 'document'),
  uploadMultipleDocuments
);

// Get routes
router.get('/my-documents', getMyDocuments);
router.get('/employee/:employeeId', authorize('admin', 'hr'), getEmployeeDocuments);
router.get('/stats', authorize('admin', 'hr'), getUploadStats);
router.get('/:id', getDocumentById);
router.get('/:id/download', downloadDocument);

// Delete route
router.delete('/:id', deleteDocument);

module.exports = router;