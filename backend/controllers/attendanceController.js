const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');

// Helper function to get start and end of day
const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Helper function to get date range for filtering
const getDateRange = (period, customDate) => {
  const now = new Date();
  let start, end;
  
  switch(period) {
    case 'daily':
      start = new Date(customDate || now);
      start.setHours(0, 0, 0, 0);
      end = new Date(customDate || now);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
  }
  
  return { start, end };
};

// @desc    Check-in employee
// @route   POST /api/attendance/check-in
// @access  Private (Employee only)
const checkIn = async (req, res) => {
  try {
    // Get employee record for logged-in user
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found. Please contact HR.',
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    
    if (existingAttendance) {
      if (existingAttendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in today',
          data: {
            checkInTime: existingAttendance.checkIn,
            status: existingAttendance.status,
          },
        });
      }
    }
    
    // Create new attendance record
    const attendance = await Attendance.create({
      employee: employee._id,
      date: new Date(),
      checkIn: new Date(),
      status: 'present', // Will be updated by pre-save middleware
      location: req.body.location || null,
      notes: req.body.notes || '',
    });
    
    // Populate employee and user details
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: {
        attendanceId: populatedAttendance._id,
        employee: populatedAttendance.employee,
        checkIn: populatedAttendance.checkIn,
        date: populatedAttendance.date,
        status: populatedAttendance.status,
        lateMinutes: populatedAttendance.lateMinutes,
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

// @desc    Check-out employee
// @route   POST /api/attendance/check-out
// @access  Private (Employee only)
const checkOut = async (req, res) => {
  try {
    // Get employee record
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find today's attendance
    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No check-in record found for today. Please check in first.',
      });
    }
    
    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today',
        data: {
          checkInTime: attendance.checkIn,
          checkOutTime: attendance.checkOut,
          totalHours: attendance.totalHours,
        },
      });
    }
    
    // Update check-out time
    attendance.checkOut = new Date();
    attendance.calculateTotalHours();
    
    // Check if half day (less than 4 hours)
    if (attendance.totalHours < 4) {
      attendance.status = 'half-day';
    }
    
    await attendance.save();
    
    // Populate details
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: {
        attendanceId: populatedAttendance._id,
        employee: populatedAttendance.employee,
        checkIn: populatedAttendance.checkIn,
        checkOut: populatedAttendance.checkOut,
        totalHours: populatedAttendance.totalHours,
        status: populatedAttendance.status,
        date: populatedAttendance.date,
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

// @desc    Get logged-in employee's attendance records
// @route   GET /api/attendance/my
// @access  Private
const getMyAttendance = async (req, res) => {
  try {
    // Get employee record
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
    
    // Date filtering
    let dateFilter = {};
    if (req.query.period) {
      const { start, end } = getDateRange(req.query.period, req.query.date);
      dateFilter = {
        date: { $gte: start, $lte: end },
      };
    } else if (req.query.startDate && req.query.endDate) {
      dateFilter = {
        date: {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        },
      };
    }
    
    const query = {
      employee: employee._id,
      ...dateFilter,
    };
    
    const attendance = await Attendance.find(query)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .sort('-date')
      .skip(skip)
      .limit(limit);
    
    const total = await Attendance.countDocuments(query);
    
    // Calculate summary statistics
    const stats = await Attendance.aggregate([
      { $match: { employee: employee._id } },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          totalPresent: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          totalLate: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          totalHalfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
          totalAbsent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          totalHours: { $sum: '$totalHours' },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: attendance.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      summary: stats[0] || {
        totalDays: 0,
        totalPresent: 0,
        totalLate: 0,
        totalHalfDay: 0,
        totalAbsent: 0,
        totalHours: 0,
      },
      data: attendance,
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

// @desc    Get all attendance records (Admin/HR only)
// @route   GET /api/attendance
// @access  Private (Admin/HR only)
const getAllAttendance = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    // Filter by employee
    if (req.query.employeeId) {
      const employee = await Employee.findOne({ employeeId: req.query.employeeId });
      if (employee) {
        query.employee = employee._id;
      }
    }
    
    // Date filtering
    if (req.query.period) {
      const { start, end } = getDateRange(req.query.period, req.query.date);
      query.date = { $gte: start, $lte: end };
    } else if (req.query.startDate && req.query.endDate) {
      query.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    }
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Filter by department
    if (req.query.department) {
      const employees = await Employee.find({ department: req.query.department });
      const employeeIds = employees.map(emp => emp._id);
      query.employee = { $in: employeeIds };
    }
    
    const attendance = await Attendance.find(query)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .sort('-date')
      .skip(skip)
      .limit(limit);
    
    const total = await Attendance.countDocuments(query);
    
    // Get summary statistics
    const stats = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          averageHours: { $avg: '$totalHours' },
          totalPresent: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          totalLate: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          totalHalfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: attendance.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      summary: stats[0] || null,
      data: attendance,
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

// @desc    Get attendance for specific employee (Admin/HR)
// @route   GET /api/attendance/employee/:employeeId
// @access  Private (Admin/HR only)
const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Find employee
    const employee = await Employee.findOne({ employeeId })
      .populate('user', 'name email');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Date filtering
    let dateFilter = {};
    if (req.query.startDate && req.query.endDate) {
      dateFilter = {
        date: {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        },
      };
    } else if (req.query.month) {
      const [year, month] = req.query.month.split('-');
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      dateFilter = {
        date: { $gte: start, $lte: end },
      };
    }
    
    const query = {
      employee: employee._id,
      ...dateFilter,
    };
    
    const attendance = await Attendance.find(query)
      .sort('-date')
      .skip(skip)
      .limit(limit);
    
    const total = await Attendance.countDocuments(query);
    
    // Calculate monthly summary
    const monthlyStats = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          totalDays: { $sum: 1 },
          totalPresent: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          totalLate: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          totalHours: { $sum: '$totalHours' },
          averageHours: { $avg: '$totalHours' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);
    
    res.status(200).json({
      success: true,
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.user.name,
        email: employee.user.email,
        department: employee.department,
        position: employee.position,
      },
      count: attendance.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      monthlySummary: monthlyStats,
      data: attendance,
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

// @desc    Update attendance record (Admin/HR only)
// @route   PUT /api/attendance/:id
// @access  Private (Admin/HR only)
const updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }
    
    const { checkIn, checkOut, status, notes } = req.body;
    
    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) {
      attendance.checkOut = new Date(checkOut);
      attendance.calculateTotalHours();
    }
    if (status) attendance.status = status;
    if (notes) attendance.notes = notes;
    
    await attendance.save();
    
    const updatedAttendance = await Attendance.findById(attendance._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      data: updatedAttendance,
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

// @desc    Get attendance summary for dashboard
// @route   GET /api/attendance/summary/dashboard
// @access  Private (Admin/HR only)
const getAttendanceSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Today's stats
    const todayAttendance = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
    });
    
    const todayPresent = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['present', 'late'] },
    });
    
    const todayLate = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'late',
    });
    
    // This week stats
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weeklyStats = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: weekStart, $lt: weekEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalPresent: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
          totalLate: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          totalHalfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
          totalHours: { $sum: '$totalHours' },
        },
      },
    ]);
    
    // Monthly trend
    const monthlyTrend = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(today.getFullYear(), today.getMonth(), 1),
            $lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: '$date' },
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        today: {
          total: todayAttendance,
          present: todayPresent,
          late: todayLate,
          absent: todayAttendance - todayPresent,
        },
        weekly: weeklyStats[0] || {
          totalPresent: 0,
          totalLate: 0,
          totalHalfDay: 0,
          totalHours: 0,
        },
        monthlyTrend,
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
  checkIn,
  checkOut,
  getMyAttendance,
  getAllAttendance,
  getEmployeeAttendance,
  updateAttendance,
  getAttendanceSummary,
};