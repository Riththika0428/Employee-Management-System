const Notification = require('../models/Notification');
const { sendEmail, emailTemplates } = require('../utils/sendEmail');
const User = require('../models/User');
const Employee = require('../models/Employee');

// Socket.IO instance (will be set from server.js)
let io;

const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// Create notification and send real-time update
const createNotification = async (recipientId, notificationData, sendRealTime = true) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      ...notificationData,
    });
    
    // Populate recipient details for response
    const populatedNotification = await Notification.findById(notification._id)
      .populate('recipient', 'name email');
    
    // Send real-time notification via Socket.IO
    if (sendRealTime && io) {
      io.to(`user_${recipientId}`).emit('new_notification', populatedNotification);
      
      // Also send unread count update
      const unreadCount = await getUnreadCount(recipientId);
      io.to(`user_${recipientId}`).emit('unread_count_update', { count: unreadCount });
    }
    
    return populatedNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get unread notification count
const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

// Send email notification
const sendEmailNotification = async (recipientEmail, template, data) => {
  try {
    let templateFunction;
    let subject;
    let html;
    
    switch (template) {
      case 'welcome':
        subject = emailTemplates.welcome(data.name, data.email, data.password).subject;
        html = emailTemplates.welcome(data.name, data.email, data.password).html;
        break;
      case 'taskAssignment':
        subject = emailTemplates.taskAssignment(data.task, data.assignedTo, data.assignedBy).subject;
        html = emailTemplates.taskAssignment(data.task, data.assignedTo, data.assignedBy).html;
        break;
      case 'leaveStatus':
        subject = emailTemplates.leaveStatus(data.leave, data.employee, data.status, data.rejectionReason).subject;
        html = emailTemplates.leaveStatus(data.leave, data.employee, data.status, data.rejectionReason).html;
        break;
      case 'payrollGenerated':
        subject = emailTemplates.payrollGenerated(data.payroll, data.employee).subject;
        html = emailTemplates.payrollGenerated(data.payroll, data.employee).html;
        break;
      default:
        return { success: false, error: 'Invalid template' };
    }
    
    return await sendEmail(recipientEmail, subject, html);
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Notification triggers for different events
const notificationTriggers = {
  // Task assigned
  taskAssigned: async (task, assignedTo, assignedBy) => {
    // Get employee details
    const employee = await Employee.findById(assignedTo).populate('user');
    const assigner = await User.findById(assignedBy);
    
    if (!employee || !assigner) return;
    
    // Create in-app notification
    await createNotification(
      employee.user._id,
      {
        title: 'New Task Assigned',
        message: `You have been assigned a new task: "${task.title}" by ${assigner.name}`,
        type: 'task',
        priority: task.priority === 'urgent' ? 'urgent' : 'medium',
        actionUrl: `/tasks/${task._id}`,
        relatedData: {
          taskId: task._id,
          taskTitle: task.title,
          assignedBy: assigner.name,
        },
      }
    );
    
    // Send email notification
    await sendEmailNotification(
      employee.user.email,
      'taskAssignment',
      {
        task,
        assignedTo: employee.user,
        assignedBy: assigner,
      }
    );
  },
  
  // Leave approved/rejected
  leaveStatusUpdate: async (leave, status, rejectionReason = null) => {
    const employee = await Employee.findById(leave.employee).populate('user');
    const reviewer = await User.findById(leave.reviewedBy);
    
    if (!employee) return;
    
    const statusText = status === 'approved' ? 'Approved' : 'Rejected';
    const message = status === 'approved'
      ? `Your leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved`
      : `Your leave request has been rejected${rejectionReason ? `: ${rejectionReason}` : ''}`;
    
    // Create in-app notification
    await createNotification(
      employee.user._id,
      {
        title: `Leave Request ${statusText}`,
        message,
        type: 'leave',
        priority: 'medium',
        actionUrl: '/leaves',
        relatedData: {
          leaveId: leave._id,
          status,
          rejectionReason,
        },
      }
    );
    
    // Send email notification
    await sendEmailNotification(
      employee.user.email,
      'leaveStatus',
      {
        leave,
        employee: employee.user,
        status,
        rejectionReason,
      }
    );
  },
  
  // Payroll generated
  payrollGenerated: async (payroll, employeeId) => {
    const employee = await Employee.findById(employeeId).populate('user');
    
    if (!employee) return;
    
    // Create in-app notification
    await createNotification(
      employee.user._id,
      {
        title: `Payroll Generated - ${payroll.month}/${payroll.year}`,
        message: `Your payroll for ${payroll.month}/${payroll.year} has been generated. Net salary: ${payroll.netSalary.toLocaleString()}`,
        type: 'payroll',
        priority: 'high',
        actionUrl: '/payroll',
        relatedData: {
          payrollId: payroll._id,
          amount: payroll.netSalary,
          month: payroll.month,
          year: payroll.year,
        },
      }
    );
    
    // Send email notification
    await sendEmailNotification(
      employee.user.email,
      'payrollGenerated',
      {
        payroll,
        employee: employee.user,
      }
    );
  },
  
  // Welcome email for new employee
  welcomeEmployee: async (user, employee, password) => {
    // Create in-app notification
    await createNotification(
      user._id,
      {
        title: 'Welcome to EMS!',
        message: 'Your employee account has been created. Please login to access the system.',
        type: 'employee',
        priority: 'high',
        actionUrl: '/dashboard',
      }
    );
    
    // Send welcome email
    await sendEmailNotification(
      user.email,
      'welcome',
      {
        name: user.name,
        email: user.email,
        password,
      }
    );
  },
  
  // Attendance reminder (optional)
  attendanceReminder: async (employeeId) => {
    const employee = await Employee.findById(employeeId).populate('user');
    
    if (!employee) return;
    
    await createNotification(
      employee.user._id,
      {
        title: 'Attendance Reminder',
        message: 'Don\'t forget to mark your attendance for today!',
        type: 'attendance',
        priority: 'low',
        actionUrl: '/attendance',
      }
    );
  },
};

module.exports = {
  setIoInstance,
  createNotification,
  getUnreadCount,
  sendEmailNotification,
  notificationTriggers,
};