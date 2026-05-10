const Employee = require('../models/Employee');
const User = require('../models/User');
const { notificationTriggers } = require('../services/notificationService');

// @desc    Create new employee
// @route   POST /api/employees
// @access  Private (Admin/HR only)
const createEmployee = async (req, res) => {
  try {
    const {
      user: userId,
      employeeId,
      department,
      position,
      salary,
      joiningDate,
      status,
      contactNumber,
      address,
    } = req.body;

    // Check if user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if employee already exists for this user
    const employeeExists = await Employee.findOne({ user: userId });
    if (employeeExists) {
      return res.status(400).json({
        success: false,
        message: 'Employee already exists for this user',
      });
    }

    // Check if employeeId is unique (if provided)
    if (employeeId) {
      const empIdExists = await Employee.findOne({ employeeId });
      if (empIdExists) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists',
        });
      }
    }

    // Create employee
    const employee = await Employee.create({
      user: userId,
      employeeId,
      department,
      position,
      salary,
      joiningDate,
      status: status || 'active',
      contactNumber,
      address,
    });

    // Populate user details
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('user', 'name email role');

    // Generate temporary password and send welcome notification (real-time + email)
    try {
      const tempPassword = Math.random().toString(36).slice(-8); // Generate temp password
      // Note: We do not change the user's password here. The temp password is for email content only.
      await notificationTriggers.welcomeEmployee(populatedEmployee.user, populatedEmployee, tempPassword);
    } catch (ntfErr) {
      console.error('Error sending welcome notification:', ntfErr);
    }

    res.status(201).json({
      success: true,
      data: populatedEmployee,
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

// @desc    Get all employees with pagination, search, and filters
// @route   GET /api/employees
// @access  Private (Admin/HR only)
const getEmployees = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    // Search functionality
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      // Find users with matching name
      const users = await User.find({ name: searchRegex }).select('_id');
      const userIds = users.map(user => user._id);
      
      query = {
        $or: [
          { employeeId: searchRegex },
          { user: { $in: userIds } },
        ],
      };
    }
    
    // Filter by department
    if (req.query.department) {
      query.department = req.query.department;
    }
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Execute query with pagination
    const employees = await Employee.find(query)
      .populate('user', 'name email role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Employee.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: employees.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: employees,
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

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private (Admin/HR can view any, Employee can view only their own)
const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('user', 'name email role');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    // Check if user is employee and trying to view other's profile
    if (req.user.role === 'employee' && employee.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this employee profile',
      });
    }
    
    res.status(200).json({
      success: true,
      data: employee,
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

// @desc    Get employee by user ID
// @route   GET /api/employees/user/:userId
// @access  Private
const getEmployeeByUserId = async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.params.userId })
      .populate('user', 'name email role');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found for this user',
      });
    }
    
    // Check authorization
    if (req.user.role === 'employee' && req.params.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }
    
    res.status(200).json({
      success: true,
      data: employee,
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

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin/HR only)
const updateEmployee = async (req, res) => {
  try {
    let employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    const {
      department,
      position,
      salary,
      joiningDate,
      status,
      contactNumber,
      address,
      employeeId,
    } = req.body;
    
    // Check if employeeId is being updated and is unique
    if (employeeId && employeeId !== employee.employeeId) {
      const empIdExists = await Employee.findOne({ employeeId });
      if (empIdExists) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists',
        });
      }
    }
    
    // Update fields
    employee.department = department || employee.department;
    employee.position = position || employee.position;
    employee.salary = salary || employee.salary;
    employee.joiningDate = joiningDate || employee.joiningDate;
    employee.status = status || employee.status;
    employee.contactNumber = contactNumber || employee.contactNumber;
    employee.address = address || employee.address;
    if (employeeId) employee.employeeId = employeeId;
    
    await employee.save();
    
    const updatedEmployee = await Employee.findById(employee._id)
      .populate('user', 'name email role');
    
    res.status(200).json({
      success: true,
      data: updatedEmployee,
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

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private (Admin/HR only)
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    await employee.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Employee removed successfully',
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

// @desc    Get employee statistics
// @route   GET /api/employees/stats/dashboard
// @access  Private (Admin/HR only)
const getEmployeeStats = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    const inactiveEmployees = await Employee.countDocuments({ status: 'inactive' });
    
    const departmentStats = await Employee.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
        },
      },
    ]);
    
    const recentEmployees = await Employee.find()
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        total: totalEmployees,
        active: activeEmployees,
        inactive: inactiveEmployees,
        departments: departmentStats,
        recent: recentEmployees,
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
  createEmployee,
  getEmployees,
  getEmployee,
  getEmployeeByUserId,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
};