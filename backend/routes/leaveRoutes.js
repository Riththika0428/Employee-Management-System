const express = require('express');
const router = express.Router();
const {
  applyForLeave,
  getMyLeaves,
  getAllLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getLeaveBalance,
  getLeaveStatistics,
} = require('../controllers/leaveController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes protected
router.use(protect);

// Employee routes
router.post('/', applyForLeave);
router.get('/my', getMyLeaves);
router.get('/balance', getLeaveBalance);

// Admin/HR routes
router.get('/', authorize('admin', 'hr'), getAllLeaves);
router.get('/statistics', authorize('admin', 'hr'), getLeaveStatistics);
router.patch('/:id/approve', authorize('admin', 'hr'), approveLeave);
router.patch('/:id/reject', authorize('admin', 'hr'), rejectLeave);

// Single leave
router.get('/:id', getLeaveById);
router.delete('/:id', cancelLeave);

module.exports = router;
