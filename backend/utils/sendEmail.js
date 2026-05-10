const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // For development only
    },
  });
};

// Email templates
const emailTemplates = {
  // Welcome email template
  welcome: (name, email, password) => ({
    subject: 'Welcome to Employee Management System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to EMS, ${name}!</h2>
        <p>Your employee account has been created successfully.</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Account Details:</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p><strong>Login URL:</strong> ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login</p>
        </div>
        <p>Please change your password after first login.</p>
        <p>Best regards,<br>EMS Team</p>
      </div>
    `,
  }),

  // Task assignment email
  taskAssignment: (task, assignedTo, assignedBy) => ({
    subject: `New Task Assigned: ${task.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">New Task Assigned</h2>
        <p>Hello ${assignedTo.name},</p>
        <p>You have been assigned a new task by ${assignedBy.name}.</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Task Details:</h3>
          <p><strong>Title:</strong> ${task.title}</p>
          <p><strong>Description:</strong> ${task.description.substring(0, 200)}</p>
          <p><strong>Priority:</strong> ${task.priority}</p>
          <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/tasks/${task._id}" 
           style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Task
        </a>
        <p style="margin-top: 20px;">Best regards,<br>EMS Team</p>
      </div>
    `,
  }),

  // Leave status update email
  leaveStatus: (leave, employee, status, rejectionReason = null) => ({
    subject: `Leave Request ${status.toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
        <p>Hello ${employee.name},</p>
        <p>Your leave request has been ${status}.</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Leave Details:</h3>
          <p><strong>Type:</strong> ${leave.leaveType}</p>
          <p><strong>Duration:</strong> ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()}</p>
          <p><strong>Total Days:</strong> ${leave.totalDays}</p>
          ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
        </div>
        <a href="${process.env.FRONTEND_URL}/leaves" 
           style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Leave History
        </a>
        <p style="margin-top: 20px;">Best regards,<br>EMS Team</p>
      </div>
    `,
  }),

  // Payroll generated email
  payrollGenerated: (payroll, employee) => ({
    subject: `Payroll Generated for ${payroll.month}/${payroll.year}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Payroll Generated</h2>
        <p>Hello ${employee.name},</p>
        <p>Your payroll for ${payroll.month}/${payroll.year} has been generated.</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Salary Details:</h3>
          <p><strong>Basic Salary:</strong> ${payroll.basicSalary.toLocaleString()}</p>
          <p><strong>Bonus:</strong> ${payroll.bonus.toLocaleString()}</p>
          <p><strong>Deductions:</strong> ${payroll.totalDeductions.toLocaleString()}</p>
          <p><strong>Net Salary:</strong> ${payroll.netSalary.toLocaleString()}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/payroll" 
           style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Payroll
        </a>
        <p style="margin-top: 20px;">Best regards,<br>Finance Team</p>
      </div>
    `,
  }),
};

// Send email function
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"EMS System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  emailTemplates,
};