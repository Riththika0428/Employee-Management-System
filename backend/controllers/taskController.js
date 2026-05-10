const Task = require('../models/Task');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { notificationTriggers } = require('../services/notificationService');

// Helper function to validate status transitions
const isValidStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    'pending': ['in-progress', 'cancelled'],
    'in-progress': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
  };
  
  return validTransitions[currentStatus].includes(newStatus);
};

// Helper function to get date range for filtering
const getDateRange = (period) => {
  const now = new Date();
  let start, end;
  
  switch(period) {
    case 'today':
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    default:
      return null;
  }
  
  return { start, end };
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private (Admin/HR only)
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      priority,
      deadline,
      remarks,
      tags,
      estimatedHours,
    } = req.body;
    
    // Check if assigned employee exists
    const employee = await Employee.findById(assignedTo);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Assigned employee not found',
      });
    }
    
    // Create task
    const task = await Task.create({
      title,
      description,
      assignedTo,
      assignedBy: req.user.id,
      priority: priority || 'medium',
      deadline,
      remarks: remarks || '',
      tags: tags || [],
      estimatedHours: estimatedHours || 0,
    });
    
    // Trigger notification for task assignment (real-time + email)
    try {
      await notificationTriggers.taskAssigned(task, assignedTo, req.user.id);
    } catch (ntfErr) {
      console.error('Error triggering task assigned notification:', ntfErr);
    }

    // Populate task details
    const populatedTask = await Task.findById(task._id)
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'assignedBy',
        select: 'name email role',
      });
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: populatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all tasks (Admin/HR only)
// @route   GET /api/tasks
// @access  Private (Admin/HR only)
const getAllTasks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by priority
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    
    // Filter by assigned employee
    if (req.query.employeeId) {
      const employee = await Employee.findOne({ employeeId: req.query.employeeId });
      if (employee) {
        query.assignedTo = employee._id;
      } else {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          data: [],
        });
      }
    }
    
    // Filter by department
    if (req.query.department) {
      const employees = await Employee.find({ department: req.query.department });
      const employeeIds = employees.map(emp => emp._id);
      query.assignedTo = { $in: employeeIds };
    }
    
    // Filter by deadline range
    if (req.query.deadlineFrom || req.query.deadlineTo) {
      query.deadline = {};
      if (req.query.deadlineFrom) {
        query.deadline.$gte = new Date(req.query.deadlineFrom);
      }
      if (req.query.deadlineTo) {
        query.deadline.$lte = new Date(req.query.deadlineTo);
      }
    }
    
    // Period filter
    if (req.query.period) {
      const dateRange = getDateRange(req.query.period);
      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.start,
          $lte: dateRange.end,
        };
      }
    }
    
    // Search by title
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: 'i' };
    }
    
    // Overdue filter
    if (req.query.overdue === 'true') {
      query.deadline = { $lt: new Date() };
      query.status = { $ne: 'completed' };
    }
    
    // Execute query
    const tasks = await Task.find(query)
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'assignedBy',
        select: 'name email role',
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    const total = await Task.countDocuments(query);
    
    // Get statistics
    const stats = await Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
          },
          overdueTasks: {
            $sum: {
              $cond: [
                { $and: [
                  { $lt: ['$deadline', new Date()] },
                  { $ne: ['$status', 'completed'] }
                ] },
                1,
                0
              ],
            },
          },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      statistics: stats[0] || {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
      },
      data: tasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get my assigned tasks (Employee)
// @route   GET /api/tasks/my
// @access  Private
const getMyTasks = async (req, res) => {
  try {
    // Get employee record for logged-in user
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { assignedTo: employee._id };
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by priority
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    
    // Filter by deadline range
    if (req.query.deadlineFrom || req.query.deadlineTo) {
      query.deadline = {};
      if (req.query.deadlineFrom) {
        query.deadline.$gte = new Date(req.query.deadlineFrom);
      }
      if (req.query.deadlineTo) {
        query.deadline.$lte = new Date(req.query.deadlineTo);
      }
    }
    
    // Search by title
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: 'i' };
    }
    
    // Get tasks
    const tasks = await Task.find(query)
      .populate({
        path: 'assignedBy',
        select: 'name email role',
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    const total = await Task.countDocuments(query);
    
    // Calculate my statistics
    const myStats = await Task.aggregate([
      { $match: { assignedTo: employee._id } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
          },
          overdueTasks: {
            $sum: {
              $cond: [
                { $and: [
                  { $lt: ['$deadline', new Date()] },
                  { $ne: ['$status', 'completed'] }
                ] },
                1,
                0
              ],
            },
          },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      statistics: myStats[0] || {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
      },
      data: tasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private (Admin/HR can view any, Employee can view only assigned)
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'assignedBy',
        select: 'name email role',
      });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || task.assignedTo._id.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this task',
        });
      }
    }
    
    // Add overdue status to response
    const taskData = task.toObject();
    taskData.isOverdue = task.isOverdue();
    taskData.progress = task.getProgress();
    
    res.status(200).json({
      success: true,
      data: taskData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update task details (Admin/HR only)
// @route   PUT /api/tasks/:id
// @access  Private (Admin/HR only)
const updateTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    
    const {
      title,
      description,
      assignedTo,
      priority,
      deadline,
      remarks,
      tags,
      estimatedHours,
    } = req.body;
    
    // Check if new assigned employee exists
    if (assignedTo) {
      const employee = await Employee.findById(assignedTo);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Assigned employee not found',
        });
      }
      task.assignedTo = assignedTo;
    }
    
    // Update fields
    task.title = title || task.title;
    task.description = description || task.description;
    task.priority = priority || task.priority;
    task.deadline = deadline || task.deadline;
    task.remarks = remarks || task.remarks;
    task.tags = tags || task.tags;
    task.estimatedHours = estimatedHours || task.estimatedHours;
    
    await task.save();
    
    const updatedTask = await Task.findById(task._id)
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'assignedBy',
        select: 'name email role',
      });
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update task status (Employee can update assigned tasks)
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res) => {
  try {
    const { status, remarks, actualHours } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide status',
      });
    }
    
    const task = await Task.findById(req.params.id)
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || task.assignedTo._id.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this task',
        });
      }
    }
    
    // Validate status transition
    if (!isValidStatusTransition(task.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${task.status} to ${status}`,
        allowedTransitions: {
          'pending': ['in-progress', 'cancelled'],
          'in-progress': ['completed', 'cancelled'],
          'completed': [],
          'cancelled': [],
        },
      });
    }
    
    // Update status
    task.status = status;
    
    // Set completedAt if status is completed
    if (status === 'completed') {
      task.completedAt = new Date();
    }
    
    // Update remarks if provided
    if (remarks) {
      task.remarks = remarks;
    }
    
    // Update actual hours if provided
    if (actualHours) {
      task.actualHours = actualHours;
    }
    
    await task.save();
    
    const updatedTask = await Task.findById(task._id)
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'assignedBy',
        select: 'name email role',
      });
    
    res.status(200).json({
      success: true,
      message: `Task status updated to ${status}`,
      data: updatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete task (Admin only)
// @route   DELETE /api/tasks/:id
// @access  Private (Admin only)
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    
    await task.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get task statistics for dashboard
// @route   GET /api/tasks/statistics
// @access  Private (Admin/HR only)
const getTaskStatistics = async (req, res) => {
  try {
    // Get overall statistics
    const overallStats = await Task.aggregate([
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
          },
          cancelledTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          averageCompletionTime: {
            $avg: {
              $subtract: ['$completedAt', '$createdAt'],
            },
          },
        },
      },
    ]);
    
    // Priority distribution
    const priorityStats = await Task.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
    ]);
    
    // Department-wise task distribution
    const departmentStats = await Task.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: '$employee.department',
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
        },
      },
    ]);
    
    // Recent overdue tasks
    const overdueTasks = await Task.find({
      deadline: { $lt: new Date() },
      status: { $ne: 'completed' },
    })
      .populate({
        path: 'assignedTo',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .sort('deadline')
      .limit(10);
    
    res.status(200).json({
      success: true,
      data: {
        overall: overallStats[0] || {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          cancelledTasks: 0,
          averageCompletionTime: 0,
        },
        priorityDistribution: priorityStats,
        departmentDistribution: departmentStats,
        overdueTasks: overdueTasks,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStatistics,
};