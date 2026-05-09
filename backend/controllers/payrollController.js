const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// Helper function to calculate overtime pay based on attendance
const calculateOvertimePay = async (employeeId, month, year, hourlyRate) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  const attendance = await Attendance.find({
    employee: employeeId,
    date: { $gte: startDate, $lte: endDate },
    status: { $in: ['present', 'late'] },
  });
  
  // Calculate overtime (assuming work hours > 8 counts as overtime)
  let overtimeHours = 0;
  attendance.forEach(record => {
    if (record.totalHours > 8) {
      overtimeHours += (record.totalHours - 8);
    }
  });
  
  return overtimeHours * hourlyRate * 1.5; // 1.5x for overtime
};

// @desc    Generate payroll for employee
// @route   POST /api/payroll
// @access  Private (Admin/HR only)
const generatePayroll = async (req, res) => {
  try {
    const {
      employee: employeeId,
      basicSalary,
      allowances,
      bonus,
      deductions,
      month,
      year,
      notes,
    } = req.body;
    
    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    // Check if payroll already exists for this employee/month/year
    const existingPayroll = await Payroll.findOne({
      employee: employeeId,
      month,
      year,
    });
    
    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: `Payroll already exists for ${employee.employeeId} for ${month}/${year}`,
        data: existingPayroll,
      });
    }
    
    // Calculate overtime pay from attendance
    const hourlyRate = basicSalary / (22 * 8); // Assuming 22 working days, 8 hours/day
    const overtimePay = await calculateOvertimePay(employeeId, month, year, hourlyRate);
    
    // Create payroll
    const payroll = await Payroll.create({
      employee: employeeId,
      basicSalary: basicSalary || employee.salary,
      allowances: allowances || {
        houseRent: (basicSalary || employee.salary) * 0.3,
        dearness: (basicSalary || employee.salary) * 0.1,
        medical: 1000,
        travel: 500,
        other: 0,
      },
      bonus: bonus || 0,
      overtimePay,
      deductions: deductions || {
        tax: (basicSalary || employee.salary) * 0.1,
        providentFund: (basicSalary || employee.salary) * 0.12,
        healthInsurance: 500,
        loan: 0,
        advance: 0,
        other: 0,
      },
      month,
      year,
      generatedBy: req.user.id,
      notes: notes || '',
    });
    
    // Populate payroll details
    const populatedPayroll = await Payroll.findById(payroll._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'generatedBy',
        select: 'name email',
      });
    
    res.status(201).json({
      success: true,
      message: 'Payroll generated successfully',
      data: populatedPayroll,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate payroll entry. Payroll already exists for this employee/month/year.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all payroll records (Admin/HR only)
// @route   GET /api/payroll
// @access  Private (Admin/HR only)
const getAllPayroll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    // Filter by month
    if (req.query.month) {
      query.month = parseInt(req.query.month);
    }
    
    // Filter by year
    if (req.query.year) {
      query.year = parseInt(req.query.year);
    }
    
    // Filter by payment status
    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }
    
    // Search by employee name or employeeId
    if (req.query.search) {
      const employees = await Employee.find({
        $or: [
          { employeeId: { $regex: req.query.search, $options: 'i' } },
        ],
      });
      
      // Also search by user name through employee
      const users = await User.find({
        name: { $regex: req.query.search, $options: 'i' },
      });
      
      const employeeIds = [...employees.map(e => e._id)];
      
      // Get employees from users
      const employeesFromUsers = await Employee.find({
        user: { $in: users.map(u => u._id) },
      });
      employeesFromUsers.forEach(e => employeeIds.push(e._id));
      
      query.employee = { $in: [...new Set(employeeIds)] };
    }
    
    // Filter by department
    if (req.query.department) {
      const employees = await Employee.find({ department: req.query.department });
      const employeeIds = employees.map(emp => emp._id);
      query.employee = { $in: employeeIds };
    }
    
    // Get payroll records
    const payrollRecords = await Payroll.find(query)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'generatedBy',
        select: 'name email',
      })
      .sort('-year -month')
      .skip(skip)
      .limit(limit);
    
    const total = await Payroll.countDocuments(query);
    
    // Get summary statistics
    const stats = await Payroll.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPayrollAmount: { $sum: '$netSalary' },
          averageSalary: { $avg: '$netSalary' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$netSalary', 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$netSalary', 0],
            },
          },
          payrollCount: { $sum: 1 },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] },
          },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: payrollRecords.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      statistics: stats[0] || {
        totalPayrollAmount: 0,
        averageSalary: 0,
        totalPaid: 0,
        totalPending: 0,
        payrollCount: 0,
        paidCount: 0,
        pendingCount: 0,
      },
      data: payrollRecords,
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

// @desc    Get my payroll records (Employee)
// @route   GET /api/payroll/my
// @access  Private
const getMyPayroll = async (req, res) => {
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
    const limit = parseInt(req.query.limit) || 12; // Show last 12 months by default
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { employee: employee._id };
    
    // Optional filters
    if (req.query.year) {
      query.year = parseInt(req.query.year);
    }
    
    if (req.query.month) {
      query.month = parseInt(req.query.month);
    }
    
    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }
    
    const payrollRecords = await Payroll.find(query)
      .populate({
        path: 'generatedBy',
        select: 'name email',
      })
      .sort('-year -month')
      .skip(skip)
      .limit(limit);
    
    const total = await Payroll.countDocuments(query);
    
    // Calculate my salary summary
    const myStats = await Payroll.aggregate([
      { $match: { employee: employee._id } },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$netSalary' },
          averageSalary: { $avg: '$netSalary' },
          highestSalary: { $max: '$netSalary' },
          lowestSalary: { $min: '$netSalary' },
          totalBonus: { $sum: '$bonus' },
          totalDeductions: { $sum: '$totalDeductions' },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: payrollRecords.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statistics: myStats[0] || {
        totalEarned: 0,
        averageSalary: 0,
        highestSalary: 0,
        lowestSalary: 0,
        totalBonus: 0,
        totalDeductions: 0,
      },
      data: payrollRecords,
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

// @desc    Get single payroll record
// @route   GET /api/payroll/:id
// @access  Private (Admin/HR can view any, Employee can view own)
const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'generatedBy',
        select: 'name email',
      });
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || payroll.employee._id.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this payroll record',
        });
      }
    }
    
    // Add additional info to response
    const payrollData = payroll.toObject();
    payrollData.payslipNumber = payroll.generatePayslipNumber();
    payrollData.isOverdue = payroll.isOverdue();
    
    res.status(200).json({
      success: true,
      data: payrollData,
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

// @desc    Update payroll record (Admin/HR only)
// @route   PUT /api/payroll/:id
// @access  Private (Admin/HR only)
const updatePayroll = async (req, res) => {
  try {
    let payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found',
      });
    }
    
    const {
      basicSalary,
      allowances,
      bonus,
      overtimePay,
      deductions,
      notes,
    } = req.body;
    
    // Update fields
    if (basicSalary) payroll.basicSalary = basicSalary;
    if (allowances) payroll.allowances = { ...payroll.allowances, ...allowances };
    if (bonus !== undefined) payroll.bonus = bonus;
    if (overtimePay !== undefined) payroll.overtimePay = overtimePay;
    if (deductions) payroll.deductions = { ...payroll.deductions, ...deductions };
    if (notes) payroll.notes = notes;
    
    await payroll.save();
    
    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'generatedBy',
        select: 'name email',
      });
    
    res.status(200).json({
      success: true,
      message: 'Payroll updated successfully',
      data: updatedPayroll,
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

// @desc    Mark payroll as paid
// @route   PATCH /api/payroll/:id/pay
// @access  Private (Admin/HR only)
const markAsPaid = async (req, res) => {
  try {
    const { paymentMethod, transactionId } = req.body;
    
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found',
      });
    }
    
    if (payroll.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payroll already marked as paid',
      });
    }
    
    payroll.paymentStatus = 'paid';
    payroll.paymentDate = new Date();
    payroll.paymentMethod = paymentMethod || 'bank_transfer';
    if (transactionId) payroll.transactionId = transactionId;
    
    await payroll.save();
    
    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .populate({
        path: 'generatedBy',
        select: 'name email',
      });
    
    res.status(200).json({
      success: true,
      message: 'Payroll marked as paid successfully',
      data: updatedPayroll,
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

// @desc    Delete payroll record (Admin only)
// @route   DELETE /api/payroll/:id
// @access  Private (Admin only)
const deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found',
      });
    }
    
    await payroll.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Payroll record deleted successfully',
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

// @desc    Get payroll summary for dashboard
// @route   GET /api/payroll/summary
// @access  Private (Admin/HR only)
const getPayrollSummary = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Monthly summary for current year
    const monthlySummary = await Payroll.aggregate([
      {
        $match: {
          year: currentYear,
        },
      },
      {
        $group: {
          _id: '$month',
          totalAmount: { $sum: '$netSalary' },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$netSalary', 0],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$netSalary', 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    
    // Department-wise payroll summary
    const departmentSummary = await Payroll.aggregate([
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
          totalPayroll: { $sum: '$netSalary' },
          averageSalary: { $avg: '$netSalary' },
          employeeCount: { $addToSet: '$employee' },
        },
      },
      {
        $project: {
          department: '$_id',
          totalPayroll: 1,
          averageSalary: 1,
          employeeCount: { $size: '$employeeCount' },
        },
      },
    ]);
    
    // Yearly comparison
    const yearlyComparison = await Payroll.aggregate([
      {
        $group: {
          _id: '$year',
          totalPayroll: { $sum: '$netSalary' },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$netSalary', 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$netSalary', 0],
            },
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 3 },
    ]);
    
    // Top earners
    const topEarners = await Payroll.aggregate([
      {
        $match: {
          year: currentYear,
          month: currentMonth,
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
        $lookup: {
          from: 'users',
          localField: 'employeeDetails.user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          employeeName: '$userDetails.name',
          employeeId: '$employeeDetails.employeeId',
          department: '$employeeDetails.department',
          netSalary: 1,
        },
      },
      { $sort: { netSalary: -1 } },
      { $limit: 5 },
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        currentYear,
        currentMonth,
        monthlySummary,
        departmentSummary,
        yearlyComparison,
        topEarners,
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

// @desc    Generate payslip PDF URL (placeholder for actual PDF generation)
// @route   GET /api/payroll/:id/payslip
// @access  Private
const generatePayslip = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || payroll.employee._id.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this payslip',
        });
      }
    }
    
    // In a real implementation, generate PDF here
    // For now, return a simulated response
    const payslipData = {
      payslipNumber: payroll.generatePayslipNumber(),
      employeeName: payroll.employee.user.name,
      employeeId: payroll.employee.employeeId,
      department: payroll.employee.department,
      position: payroll.employee.position,
      month: payroll.month,
      year: payroll.year,
      basicSalary: payroll.basicSalary,
      allowances: payroll.allowances,
      totalAllowances: payroll.totalAllowances,
      bonus: payroll.bonus,
      overtimePay: payroll.overtimePay,
      deductions: payroll.deductions,
      totalDeductions: payroll.totalDeductions,
      netSalary: payroll.netSalary,
      paymentStatus: payroll.paymentStatus,
      paymentDate: payroll.paymentDate,
    };
    
    res.status(200).json({
      success: true,
      message: 'Payslip generated',
      data: payslipData,
      // In production, this would be a PDF URL
      payslipUrl: `/api/payroll/${payroll._id}/download`,
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
  generatePayroll,
  getAllPayroll,
  getMyPayroll,
  getPayrollById,
  updatePayroll,
  markAsPaid,
  deletePayroll,
  getPayrollSummary,
  generatePayslip,
};