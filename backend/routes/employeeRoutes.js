const express = require('express');
const router = express.Router();
const {
  createEmployee,
  getEmployees,
  getEmployee,
  getEmployeeByUserId,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Stats route (Admin/HR only)
router.get('/stats', authorize('admin', 'hr'), getEmployeeStats);

// Get employee by user ID
router.get('/user/:userId', getEmployee);

// Create employee (Admin/HR only)
router.post('/', authorize('admin', 'hr'), createEmployee);

// Get all employees (Admin/HR only)
router.get('/', authorize('admin', 'hr'), getEmployees);

// Get, update, delete employee by ID
router.route('/:id')
  .get(getEmployee)
  .put(authorize('admin', 'hr'), updateEmployee)
  .delete(authorize('admin', 'hr'), deleteEmployee);

module.exports = router;