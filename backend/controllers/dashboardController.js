const Employee = require('../models/Employee');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Task = require('../models/Task');
const Payroll = require('../models/Payroll');
const LeaveBalance = require('../models/LeaveBalance');

// Helper function to get date ranges
const getDateRanges = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  
  return {
    today,
    startOfWeek,
    startOfMonth,
    startOfYear,
    endOfMonth,
    endOfYear,
  };
};

// @desc    Admin Dashboard
// @route   GET /api/dashboard/admin
// @access  Private (Admin only)
const getAdminDashboard = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    const dateRanges = getDateRanges();
    
    // Build date filters
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    }
    
    let employeeFilter = {};
    if (department) {
      employeeFilter.department = department;
    }
    
    // Execute queries in parallel for better performance
    const [
      totalEmployees,
      departmentCount,
      activeEmployees,
      inactiveEmployees,
      employeesJoinedThisMonth,
      totalPayrollExpenses,
      pendingLeaves,
      totalTasks,
      completedTasks,
      attendancePercentage,
      monthlyJoiningStats,
      monthlyPayrollStats,
      monthlyTaskStats,
      monthlyAttendanceStats,
      topPerformers,
      departmentWiseStats,
    ] = await Promise.all([
      // Total employees
      Employee.countDocuments(employeeFilter),
      
      // Total departments
      Employee.distinct('department', employeeFilter).then(depts => depts.length),
      
      // Active employees
      Employee.countDocuments({ ...employeeFilter, status: 'active' }),
      
      // Inactive employees
      Employee.countDocuments({ ...employeeFilter, status: 'inactive' }),
      
      // Employees joined this month
      Employee.countDocuments({
        ...employeeFilter,
        joiningDate: {
          $gte: dateRanges.startOfMonth,
          $lte: dateRanges.endOfMonth,
        },
      }),
      
      // Total payroll expenses (current month)
      Payroll.aggregate([
        {
          $match: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            paymentStatus: 'paid',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$netSalary' },
          },
        },
      ]),
      
      // Pending leave requests
      Leave.countDocuments({ status: 'pending' }),
      
      // Total tasks
      Task.countDocuments(),
      
      // Completed tasks
      Task.countDocuments({ status: 'completed' }),
      
      // Attendance percentage for current month
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: dateRanges.startOfMonth,
              $lte: dateRanges.endOfMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalPresent: {
              $sum: {
                $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0],
              },
            },
            totalRecords: { $sum: 1 },
          },
        },
      ]),
      
      // Monthly employee joining statistics (last 12 months)
      Employee.aggregate([
        {
          $match: {
            joiningDate: { $gte: dateRanges.startOfYear },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$joiningDate' },
              month: { $month: '$joiningDate' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      
      // Monthly payroll expense trend (last 12 months)
      Payroll.aggregate([
        {
          $match: {
            year: { $gte: new Date().getFullYear() - 1 },
          },
        },
        {
          $group: {
            _id: {
              year: '$year',
              month: '$month',
            },
            total: { $sum: '$netSalary' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      
      // Monthly task statistics
      Task.aggregate([
        {
          $match: {
            createdAt: { $gte: dateRanges.startOfYear },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      
      // Monthly attendance trends
      Attendance.aggregate([
        {
          $match: {
            date: { $gte: dateRanges.startOfYear },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      
      // Top performers (employees with most completed tasks)
      Task.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$assignedTo',
            completedTasks: { $sum: 1 },
          },
        },
        { $sort: { completedTasks: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'employees',
            localField: '_id',
            foreignField: '_id',
            as: 'employee',
          },
        },
        { $unwind: '$employee' },
        {
          $lookup: {
            from: 'users',
            localField: 'employee.user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            name: '$user.name',
            employeeId: '$employee.employeeId',
            department: '$employee.department',
            completedTasks: 1,
          },
        },
      ]),
      
      // Department-wise statistics
      Employee.aggregate([
        {
          $group: {
            _id: '$department',
            totalEmployees: { $sum: 1 },
            activeEmployees: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);
    
    // Process payroll total
    const payrollTotal = totalPayrollExpenses[0]?.total || 0;
    
    // Process attendance percentage
    const attendanceData = attendancePercentage[0] || { totalPresent: 0, totalRecords: 0 };
    const attendanceRate = attendanceData.totalRecords > 0
      ? ((attendanceData.totalPresent / attendanceData.totalRecords) * 100).toFixed(2)
      : 0;
    
    // Process task completion rate
    const taskCompletionRate = totalTasks > 0
      ? ((completedTasks / totalTasks) * 100).toFixed(2)
      : 0;
    
    // Format monthly joining stats for charts
    const monthlyJoiningData = Array(12).fill(0);
    monthlyJoiningStats.forEach(stat => {
      if (stat._id.month >= 1 && stat._id.month <= 12) {
        monthlyJoiningData[stat._id.month - 1] = stat.count;
      }
    });
    
    // Format monthly payroll data
    const monthlyPayrollData = Array(12).fill(0);
    monthlyPayrollStats.forEach(stat => {
      if (stat._id.month >= 1 && stat._id.month <= 12) {
        monthlyPayrollData[stat._id.month - 1] = stat.total;
      }
    });
    
    // Format task trends
    const taskTrends = {
      pending: Array(12).fill(0),
      'in-progress': Array(12).fill(0),
      completed: Array(12).fill(0),
    };
    
    monthlyTaskStats.forEach(stat => {
      if (stat._id.month >= 1 && stat._id.month <= 12) {
        const status = stat._id.status;
        if (taskTrends[status]) {
          taskTrends[status][stat._id.month - 1] = stat.count;
        }
      }
    });
    
    // Format attendance trends
    const attendanceTrends = {
      present: Array(12).fill(0),
      late: Array(12).fill(0),
      absent: Array(12).fill(0),
    };
    
    monthlyAttendanceStats.forEach(stat => {
      if (stat._id.month >= 1 && stat._id.month <= 12) {
        const status = stat._id.status;
        if (attendanceTrends[status]) {
          attendanceTrends[status][stat._id.month - 1] = stat.count;
        } else if (status === 'present' || status === 'late') {
          attendanceTrends.present[stat._id.month - 1] += stat.count;
        } else if (status === 'absent') {
          attendanceTrends.absent[stat._id.month - 1] += stat.count;
        }
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalEmployees,
          totalDepartments: departmentCount,
          activeEmployees,
          inactiveEmployees,
          employeesJoinedThisMonth,
          totalPayrollExpenses: payrollTotal,
          pendingLeaves,
          totalTasks,
          completedTasks,
          taskCompletionRate: parseFloat(taskCompletionRate),
          attendanceRate: parseFloat(attendanceRate),
        },
        charts: {
          monthlyJoiningStats: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            data: monthlyJoiningData,
          },
          monthlyPayrollStats: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            data: monthlyPayrollData,
          },
          taskTrends: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
              { label: 'Pending', data: taskTrends.pending },
              { label: 'In Progress', data: taskTrends['in-progress'] },
              { label: 'Completed', data: taskTrends.completed },
            ],
          },
          attendanceTrends: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
              { label: 'Present', data: attendanceTrends.present },
              { label: 'Late', data: attendanceTrends.late },
              { label: 'Absent', data: attendanceTrends.absent },
            ],
          },
        },
        topPerformers,
        departmentWiseStats,
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

// @desc    HR Dashboard
// @route   GET /api/dashboard/hr
// @access  Private (Admin/HR only)
const getHRDashboard = async (req, res) => {
  try {
    const dateRanges = getDateRanges();
    
    // Execute queries in parallel
    const [
      employeeSummary,
      todayAttendance,
      pendingLeaves,
      upcomingDeadlines,
      payrollSummary,
      taskProgress,
      departmentAttendance,
      recentLeaves,
      upcomingBirthdays,
    ] = await Promise.all([
      // Employee summary by department
      Employee.aggregate([
        {
          $group: {
            _id: '$department',
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            onLeave: {
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] },
            },
          },
        },
      ]),
      
      // Today's attendance summary
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: dateRanges.today,
              $lt: new Date(dateRanges.today.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: null,
            present: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] },
            },
            late: {
              $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ]),
      
      // Pending leave approvals with employee details
      Leave.find({ status: 'pending' })
        .populate({
          path: 'employee',
          populate: {
            path: 'user',
            select: 'name email',
          },
        })
        .sort('appliedAt')
        .limit(10),
      
      // Upcoming deadlines (tasks due in next 7 days)
      Task.find({
        deadline: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        status: { $ne: 'completed' },
      })
        .populate({
          path: 'assignedTo',
          populate: {
            path: 'user',
            select: 'name',
          },
        })
        .sort('deadline')
        .limit(10),
      
      // Payroll summary for current month
      Payroll.aggregate([
        {
          $match: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
          },
        },
        {
          $group: {
            _id: '$paymentStatus',
            totalAmount: { $sum: '$netSalary' },
            count: { $sum: 1 },
          },
        },
      ]),
      
      // Task progress summary by department
      Task.aggregate([
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
            _id: {
              department: '$employee.department',
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.department',
            total: { $sum: '$count' },
            completed: {
              $sum: {
                $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0],
              },
            },
            inProgress: {
              $sum: {
                $cond: [{ $eq: ['$_id.status', 'in-progress'] }, '$count', 0],
              },
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0],
              },
            },
          },
        },
      ]),
      
      // Department-wise attendance rate (current month)
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: dateRanges.startOfMonth,
              $lte: dateRanges.endOfMonth,
            },
          },
        },
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
            totalPresent: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] },
            },
            totalDays: { $sum: 1 },
          },
        },
        {
          $project: {
            department: '$_id',
            attendanceRate: {
              $multiply: [{ $divide: ['$totalPresent', '$totalDays'] }, 100],
            },
          },
        },
      ]),
      
      // Recent leave activities
      Leave.find({ status: { $ne: 'pending' } })
        .populate({
          path: 'employee',
          populate: {
            path: 'user',
            select: 'name',
          },
        })
        .sort('-reviewedAt')
        .limit(5),
      
      // Upcoming birthdays
      Employee.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            name: '$user.name',
            email: '$user.email',
            department: 1,
            birthday: {
              $dateToString: {
                format: '%m-%d',
                date: '$user.createdAt', // Note: You'd need a birthday field in User model
              },
            },
          },
        },
      ]),
    ]);
    
    // Process attendance summary
    const attendanceData = todayAttendance[0] || {
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
    };
    
    // Process payroll summary
    const payrollStats = {
      paid: { amount: 0, count: 0 },
      pending: { amount: 0, count: 0 },
    };
    
    payrollSummary.forEach(item => {
      if (item._id === 'paid') {
        payrollStats.paid.amount = item.totalAmount;
        payrollStats.paid.count = item.count;
      } else if (item._id === 'pending') {
        payrollStats.pending.amount = item.totalAmount;
        payrollStats.pending.count = item.count;
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        employeeSummary,
        todayAttendance: {
          present: attendanceData.present,
          late: attendanceData.late,
          absent: attendanceData.absent,
          total: attendanceData.total,
          attendanceRate: attendanceData.total > 0
            ? ((attendanceData.present / attendanceData.total) * 100).toFixed(2)
            : 0,
        },
        pendingLeaves: {
          count: pendingLeaves.length,
          requests: pendingLeaves,
        },
        upcomingDeadlines: {
          count: upcomingDeadlines.length,
          tasks: upcomingDeadlines,
        },
        payrollSummary: payrollStats,
        taskProgress,
        departmentAttendance,
        recentActivities: {
          recentLeaves,
          upcomingBirthdays,
        },
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

// @desc    Employee Dashboard
// @route   GET /api/dashboard/employee
// @access  Private
const getEmployeeDashboard = async (req, res) => {
  try {
    // Get employee record
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    const dateRanges = getDateRanges();
    
    // Execute queries in parallel
    const [
      attendanceSummary,
      assignedTasks,
      leaveBalance,
      latestPayroll,
      upcomingLeaves,
      taskCompletionRate,
      monthlyAttendance,
      weeklySchedule,
    ] = await Promise.all([
      // Personal attendance summary for current month
      Attendance.aggregate([
        {
          $match: {
            employee: employee._id,
            date: {
              $gte: dateRanges.startOfMonth,
              $lte: dateRanges.endOfMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            present: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] },
            },
            late: {
              $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
            },
            totalHours: { $sum: '$totalHours' },
            totalDays: { $sum: 1 },
          },
        },
      ]),
      
      // Assigned tasks (pending and in-progress)
      Task.find({
        assignedTo: employee._id,
        status: { $in: ['pending', 'in-progress'] },
      })
        .sort('-priority')
        .limit(10),
      
      // Leave balance
      LeaveBalance.findOne({
        employee: employee._id,
        year: new Date().getFullYear(),
      }),
      
      // Latest payroll details
      Payroll.findOne({ employee: employee._id })
        .sort('-year', '-month')
        .limit(1),
      
      // Upcoming approved leaves
      Leave.find({
        employee: employee._id,
        status: 'approved',
        startDate: { $gte: new Date() },
      })
        .sort('startDate')
        .limit(5),
      
      // Task completion rate
      Task.aggregate([
        { $match: { assignedTo: employee._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
      ]),
      
      // Monthly attendance trend (last 6 months)
      Attendance.aggregate([
        {
          $match: {
            employee: employee._id,
            date: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 5)),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
            },
            present: {
              $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      
      // Weekly schedule (attendance for current week)
      Attendance.find({
        employee: employee._id,
        date: {
          $gte: dateRanges.startOfWeek,
          $lte: dateRanges.today,
        },
      }).sort('date'),
    ]);
    
    // Process attendance summary
    const attendanceData = attendanceSummary[0] || {
      present: 0,
      late: 0,
      absent: 0,
      totalHours: 0,
      totalDays: 0,
    };
    
    const attendanceRate = attendanceData.totalDays > 0
      ? ((attendanceData.present / attendanceData.totalDays) * 100).toFixed(2)
      : 0;
    
    // Process task completion rate
    const taskStats = taskCompletionRate[0] || { total: 0, completed: 0 };
    const taskRate = taskStats.total > 0
      ? ((taskStats.completed / taskStats.total) * 100).toFixed(2)
      : 0;
    
    // Format monthly attendance for chart
    const monthlyAttendanceData = Array(6).fill(0);
    monthlyAttendance.forEach((item, index) => {
      if (item._id.month) {
        const rate = (item.present / item.total) * 100;
        monthlyAttendanceData[index] = rate;
      }
    });
    
    // Format weekly schedule
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyAttendanceData = weekDays.map(day => ({ day, status: 'pending' }));
    
    weeklySchedule.forEach(record => {
      const dayOfWeek = new Date(record.date).getDay();
      weeklyAttendanceData[dayOfWeek].status = record.status;
      if (record.checkIn) {
        weeklyAttendanceData[dayOfWeek].checkIn = record.checkIn;
      }
      if (record.checkOut) {
        weeklyAttendanceData[dayOfWeek].checkOut = record.checkOut;
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        employeeInfo: {
          name: req.user.name,
          email: req.user.email,
          employeeId: employee.employeeId,
          department: employee.department,
          position: employee.position,
          joiningDate: employee.joiningDate,
        },
        attendance: {
          summary: {
            present: attendanceData.present,
            late: attendanceData.late,
            absent: attendanceData.absent,
            totalHours: attendanceData.totalHours.toFixed(2),
            attendanceRate: parseFloat(attendanceRate),
          },
          monthlyTrend: {
            labels: Array(6).fill().map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - (5 - i));
              return d.toLocaleString('default', { month: 'short' });
            }),
            data: monthlyAttendanceData,
          },
          weeklySchedule: weeklyAttendanceData,
        },
        tasks: {
          pending: assignedTasks.filter(t => t.status === 'pending').length,
          inProgress: assignedTasks.filter(t => t.status === 'in-progress').length,
          completionRate: parseFloat(taskRate),
          upcomingTasks: assignedTasks,
        },
        leaveBalance: leaveBalance ? {
          annual: leaveBalance.annual,
          casual: leaveBalance.casual,
          sick: leaveBalance.sick,
          totalRemaining: leaveBalance.annual.remaining + leaveBalance.casual.remaining + leaveBalance.sick.remaining,
        } : null,
        payroll: latestPayroll ? {
          basicSalary: latestPayroll.basicSalary,
          netSalary: latestPayroll.netSalary,
          month: latestPayroll.month,
          year: latestPayroll.year,
          paymentStatus: latestPayroll.paymentStatus,
        } : null,
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

// @desc    Get Analytics Data
// @route   GET /api/dashboard/analytics
// @access  Private (Admin/HR only)
const getAnalytics = async (req, res) => {
  try {
    const { type, startDate, endDate, department } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    let end = endDate ? new Date(endDate) : new Date();
    
    let matchFilter = {
      createdAt: { $gte: start, $lte: end },
    };
    
    if (department && department !== 'all') {
      const employees = await Employee.find({ department });
      const employeeIds = employees.map(emp => emp._id);
      matchFilter.employee = { $in: employeeIds };
    }
    
    let analyticsData = {};
    
    switch(type) {
      case 'attendance':
        analyticsData = await Attendance.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
                status: '$status',
              },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: {
                year: '$_id.year',
                month: '$_id.month',
              },
              present: {
                $sum: {
                  $cond: [{ $in: ['$_id.status', ['present', 'late']] }, '$count', 0],
                },
              },
              late: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'late'] }, '$count', 0],
                },
              },
              absent: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0],
                },
              },
              total: { $sum: '$count' },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        break;
        
      case 'payroll':
        analyticsData = await Payroll.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                year: '$year',
                month: '$month',
              },
              totalAmount: { $sum: '$netSalary' },
              averageAmount: { $avg: '$netSalary' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        break;
        
      case 'tasks':
        analyticsData = await Task.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                status: '$status',
              },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: {
                year: '$_id.year',
                month: '$_id.month',
              },
              pending: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'in-progress'] }, '$count', 0],
                },
              },
              completed: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0],
                },
              },
              total: { $sum: '$count' },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        break;
        
      case 'leaves':
        analyticsData = await Leave.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                status: '$status',
              },
              count: { $sum: 1 },
              totalDays: { $sum: '$totalDays' },
            },
          },
          {
            $group: {
              _id: {
                year: '$_id.year',
                month: '$_id.month',
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
              pending: {
                $sum: {
                  $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0],
                },
              },
              totalDays: { $sum: '$totalDays' },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        break;
        
      default:
        analyticsData = [];
    }
    
    res.status(200).json({
      success: true,
      data: analyticsData,
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
  getAdminDashboard,
  getHRDashboard,
  getEmployeeDashboard,
  getAnalytics,
};