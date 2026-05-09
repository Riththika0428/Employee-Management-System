const express = require('express');
const router = express.Router();
const {
  createTask,
  getAllTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStatistics,
} = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Employee self-service routes
router.get('/my', getMyTasks);
router.patch('/:id/status', updateTaskStatus);

// Admin/HR routes
router.post('/', authorize('admin', 'hr'), createTask);
router.get('/statistics', authorize('admin', 'hr'), getTaskStatistics);
router.get('/', authorize('admin', 'hr'), getAllTasks);
router.put('/:id', authorize('admin', 'hr'), updateTask);
router.delete('/:id', authorize('admin'), deleteTask);
router.get('/:id', getTaskById);

module.exports = router;