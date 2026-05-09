const express = require('express');
const router = express.Router();
const {
  generatePayroll,
  getAllPayroll,
  getMyPayroll,
  getPayrollById,
  updatePayroll,
  markAsPaid,
  deletePayroll,
  getPayrollSummary,
  generatePayslip,
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Employee self-service routes
router.get('/my', getMyPayroll);
router.get('/:id/payslip', generatePayslip);

// Admin/HR routes
router.post('/', authorize('admin', 'hr'), generatePayroll);
router.get('/summary', authorize('admin', 'hr'), getPayrollSummary);
router.get('/', authorize('admin', 'hr'), getAllPayroll);
router.put('/:id', authorize('admin', 'hr'), updatePayroll);
router.patch('/:id/pay', authorize('admin', 'hr'), markAsPaid);
router.delete('/:id', authorize('admin'), deletePayroll);
router.get('/:id', getPayrollById);

module.exports = router;