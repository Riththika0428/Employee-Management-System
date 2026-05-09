const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getHRDashboard,
  getEmployeeDashboard,
  getAnalytics,
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Role-specific dashboards
router.get('/admin', authorize('admin'), getAdminDashboard);
router.get('/hr', authorize('admin', 'hr'), getHRDashboard);
router.get('/employee', getEmployeeDashboard);

// Analytics endpoint (Admin/HR only)
router.get('/analytics', authorize('admin', 'hr'), getAnalytics);

module.exports = router;