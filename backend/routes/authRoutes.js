const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);

// Test role-based routes (examples)
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
  res.json({
    success: true,
    message: 'Welcome Admin! You have access to this route',
  });
});

router.get('/hr-only', protect, authorize('admin', 'hr'), (req, res) => {
  res.json({
    success: true,
    message: 'Welcome HR! You have access to this route',
  });
});

module.exports = router;