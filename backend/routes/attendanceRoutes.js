const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getMyAttendance,
  getAllAttendance,
  getEmployeeAttendance,
  updateAttendance,
  getAttendanceSummary,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Employee self-service routes
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/my', getMyAttendance);

// Admin/HR routes
router.get('/summary', authorize('admin', 'hr'), getAttendanceSummary);
router.get('/employee/:employeeId', authorize('admin', 'hr'), getEmployeeAttendance);
router.put('/:id', authorize('admin', 'hr'), updateAttendance);
router.get('/', authorize('admin', 'hr'), getAllAttendance);

module.exports = router;