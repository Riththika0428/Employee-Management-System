const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Employee = require('../models/Employee');
const User = require('../models/User');

// Helper function to calculate working days between dates
const calculateWorkingDays = (startDate, endDate) => {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

// Helper function to initialize leave balance for employee
const initializeLeaveBalance = async (employeeId) => {
  let balance = await LeaveBalance.findOne({ employee: employeeId, year: new Date().getFullYear() });
  
  if (!balance) {
    balance = await LeaveBalance.create({
      employee: employeeId,
      year: new Date().getFullYear(),
    });
  }
  
  return balance;
};

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Private (Employee)
const applyForLeave = async (req, res) => {
  try {
    const {
      leaveType,
      startDate,
      endDate,
      reason,
      contactInfo,
      substituteEmployee,
    } = req.body;
    
    // Get employee record
    const employee = await Employee.findOne({ user: req.user.id });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    // Create leave object
    const leave = new Leave({
      employee: employee._id,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      contactInfo: contactInfo || {},
      substituteEmployee: substituteEmployee || null,
      appliedAt: new Date(),
    });
    
    // Validate dates
    const dateValidation = leave.isValidDates();
    if (!dateValidation.valid) {
      return res.status(400).json({
        success: false,
        message: dateValidation.message,
      });
    }
    
    // Check for overlapping leaves
    const isOverlapping = await leave.isOverlapping(
      employee._id,
      leave.startDate,
      leave.endDate
    );
    
    if (isOverlapping) {
      return res.status(400).json({
        success: false,
        message: 'You have an overlapping leave request. Please check your existing leaves.',
      });
    }
    
    // Check leave balance
    const balance = await initializeLeaveBalance(employee._id);
    const workingDays = calculateWorkingDays(leave.startDate, leave.endDate);
    
    if (!balance.hasSufficientBalance(leaveType, workingDays)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} leave balance. Available: ${balance[leaveType].remaining} days, Required: ${workingDays} days`,
        balance: {
          available: balance[leaveType].remaining,
          required: workingDays,
        },
      });
    }
    
    await leave.save();
    
    // Populate employee details
    const populatedLeave = await Leave.findById(leave._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('substituteEmployee', 'employeeId')
      .populate('reviewedBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: populatedLeave,
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

// @desc    Get my leave history (Employee)
// @route   GET /api/leaves/my
// @access  Private
const getMyLeaves = async (req, res) => {
  try {
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
    let query = { employee: employee._id };
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by leave type
    if (req.query.leaveType) {
      query.leaveType = req.query.leaveType;
    }
    
    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.startDate = { $gte: new Date(req.query.startDate) };
      query.endDate = { $lte: new Date(req.query.endDate) };
    }
    
    // Get leaves
    const leaves = await Leave.find(query)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('reviewedBy', 'name email')
      .populate('substituteEmployee', 'employeeId')
      .sort('-appliedAt')
      .skip(skip)
      .limit(limit);
    
    const total = await Leave.countDocuments(query);
    
    // Get leave balance
    const balance = await LeaveBalance.findOne({ 
      employee: employee._id,
      year: new Date().getFullYear(),
    });
    
    // Get statistics
    const stats = await Leave.aggregate([
      { $match: { employee: employee._id } },
      {
        $group: {
          _id: null,
          totalLeaves: { $sum: 1 },
          approvedLeaves: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
          },
          pendingLeaves: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          rejectedLeaves: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
          },
          totalDays: { $sum: '$totalDays' },
          approvedDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$totalDays', 0],
            },
          },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: leaves.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      leaveBalance: balance || null,
      statistics: stats[0] || {
        totalLeaves: 0,
        approvedLeaves: 0,
        pendingLeaves: 0,
        rejectedLeaves: 0,
        totalDays: 0,
        approvedDays: 0,
      },
      data: leaves,
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

// @desc    Get all leave requests (Admin/HR)
// @route   GET /api/leaves
// @access  Private (Admin/HR only)
const getAllLeaves = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by leave type
    if (req.query.leaveType) {
      query.leaveType = req.query.leaveType;
    }
    
    // Filter by department
    if (req.query.department) {
      const employees = await Employee.find({ department: req.query.department });
      const employeeIds = employees.map(emp => emp._id);
      query.employee = { $in: employeeIds };
    }
    
    // Search by employee name or ID
    if (req.query.search) {
      const employees = await Employee.find({
        $or: [
          { employeeId: { $regex: req.query.search, $options: 'i' } },
        ],
      });
      
      const users = await User.find({
        name: { $regex: req.query.search, $options: 'i' },
      });
      
      const employeeIds = [...employees.map(e => e._id)];
      const employeesFromUsers = await Employee.find({
        user: { $in: users.map(u => u._id) },
      });
      employeesFromUsers.forEach(e => employeeIds.push(e._id));
      
      query.employee = { $in: [...new Set(employeeIds)] };
    }
    
    // Filter by date range
    if (req.query.month) {
      const [year, month] = req.query.month.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      query.startDate = { $lte: endDate };
      query.endDate = { $gte: startDate };
    }
    
    // Get leaves
    const leaves = await Leave.find(query)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('reviewedBy', 'name email')
      .populate('substituteEmployee', 'employeeId')
      .sort('-appliedAt')
      .skip(skip)
      .limit(limit);
    
    const total = await Leave.countDocuments(query);
    
    // Get summary statistics
    const stats = await Leave.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          pendingRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          approvedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
          },
          rejectedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
          },
          totalDays: { $sum: '$totalDays' },
        },
      },
    ]);
    
    // Department-wise leave statistics
    const departmentStats = await Leave.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeDetails',
        },
      },
      { $unwind: '$employeeDetails' },
      {
        $group: {
          _id: '$employeeDetails.department',
          totalRequests: { $sum: 1 },
          pendingRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          approvedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
          },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: leaves.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      statistics: {
        overall: stats[0] || {
          totalRequests: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
          totalDays: 0,
        },
        byDepartment: departmentStats,
      },
      data: leaves,
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

// @desc    Get single leave request
// @route   GET /api/leaves/:id
// @access  Private
const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('reviewedBy', 'name email')
      .populate('substituteEmployee', 'employeeId');
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || leave.employee._id.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this leave request',
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: leave,
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

// @desc    Approve leave request
// @route   PATCH /api/leaves/:id/approve
// @access  Private (Admin/HR only)
const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve leave that is already ${leave.status}`,
      });
    }
    
    // Update leave status
    leave.status = 'approved';
    leave.reviewedBy = req.user.id;
    leave.reviewedAt = new Date();
    
    await leave.save();
    
    // Update leave balance
    const balance = await LeaveBalance.findOne({ 
      employee: leave.employee,
      year: new Date().getFullYear(),
    });
    
    if (balance) {
      const workingDays = calculateWorkingDays(leave.startDate, leave.endDate);
      await balance.updateBalance(leave.leaveType, workingDays, true);
    }
    
    const updatedLeave = await Leave.findById(leave._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('reviewedBy', 'name email')
      .populate('substituteEmployee', 'employeeId');
    
    res.status(200).json({
      success: true,
      message: 'Leave request approved successfully',
      data: updatedLeave,
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

// @desc    Reject leave request
// @route   PATCH /api/leaves/:id/reject
// @access  Private (Admin/HR only)
const rejectLeave = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject leave that is already ${leave.status}`,
      });
    }
    
    // Update leave status
    leave.status = 'rejected';
    leave.reviewedBy = req.user.id;
    leave.reviewedAt = new Date();
    leave.rejectionReason = rejectionReason || 'No specific reason provided';
    
    await leave.save();
    
    const updatedLeave = await Leave.findById(leave._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate('reviewedBy', 'name email')
      .populate('substituteEmployee', 'employeeId');
    
    res.status(200).json({
      success: true,
      message: 'Leave request rejected',
      data: updatedLeave,
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

// @desc    Cancel leave request (Employee only for pending leaves)
// @route   DELETE /api/leaves/:id
// @access  Private
const cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || leave.employee.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to cancel this leave request',
        });
      }
      
      // Only pending leaves can be cancelled by employee
      if (leave.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel leave that is already ${leave.status}`,
        });
      }
    }
    
    // If admin/HR, they can cancel any leave
    if (req.user.role !== 'admin' && req.user.role !== 'hr') {
      if (leave.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending leave requests can be cancelled',
        });
      }
    }
    
    leave.status = 'cancelled';
    await leave.save();
    
    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: leave,
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

// @desc    Get leave balance for current employee
// @route   GET /api/leaves/balance
// @access  Private
const getLeaveBalance = async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    let balance = await LeaveBalance.findOne({ 
      employee: employee._id,
      year: new Date().getFullYear(),
    });
    
    if (!balance) {
      balance = await initializeLeaveBalance(employee._id);
    }
    
    // Get upcoming leaves
    const upcomingLeaves = await Leave.find({
      employee: employee._id,
      status: 'approved',
      startDate: { $gte: new Date() },
    })
      .sort('startDate')
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        leaveBalance: {
          annual: balance.annual,
          casual: balance.casual,
          sick: balance.sick,
          unpaid: balance.unpaid,
        },
        year: balance.year,
        upcomingLeaves,
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

// @desc    Get leave statistics for dashboard
// @route   GET /api/leaves/statistics
// @access  Private (Admin/HR only)
const getLeaveStatistics = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Monthly leave trends
    const monthlyTrends = await Leave.aggregate([
      {
        $match: {
          year: currentYear,
        },
      },
      {
        $group: {
          _id: { month: { $month: '$startDate' }, status: '$status' },
          count: { $sum: 1 },
          days: { $sum: '$totalDays' },
        },
      },
      {
        $group: {
          _id: '$_id.month',
          pending: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0],
            },
          },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'approved'] }, '$count', 0],
            },
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'rejected'] }, '$count', 0],
            },
          },
          totalDays: { $sum: '$days' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    
    // Leave type distribution
    const typeDistribution = await Leave.aggregate([
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' },
        },
      },
    ]);
    
    // Current pending requests
    const pendingRequests = await Leave.find({ status: 'pending' })
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .sort('appliedAt')
      .limit(10);
    
    res.status(200).json({
      success: true,
      data: {
        monthlyTrends,
        typeDistribution,
        pendingCount: await Leave.countDocuments({ status: 'pending' }),
        pendingRequests,
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
  applyForLeave,
  getMyLeaves,
  getAllLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getLeaveBalance,
  getLeaveStatistics,
};