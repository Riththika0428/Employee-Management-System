const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Please add employee reference'],
    },
    basicSalary: {
      type: Number,
      required: [true, 'Please add basic salary'],
      min: [0, 'Basic salary cannot be negative'],
    },
    allowances: {
      houseRent: {
        type: Number,
        default: 0,
        min: 0,
      },
      dearness: {
        type: Number,
        default: 0,
        min: 0,
      },
      medical: {
        type: Number,
        default: 0,
        min: 0,
      },
      travel: {
        type: Number,
        default: 0,
        min: 0,
      },
      other: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    bonus: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimePay: {
      type: Number,
      default: 0,
      min: 0,
    },
    deductions: {
      tax: {
        type: Number,
        default: 0,
        min: 0,
      },
      providentFund: {
        type: Number,
        default: 0,
        min: 0,
      },
      healthInsurance: {
        type: Number,
        default: 0,
        min: 0,
      },
      loan: {
        type: Number,
        default: 0,
        min: 0,
      },
      advance: {
        type: Number,
        default: 0,
        min: 0,
      },
      other: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    totalAllowances: {
      type: Number,
      default: 0,
    },
    totalDeductions: {
      type: Number,
      default: 0,
    },
    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    paymentDate: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cash', 'check', 'online'],
    },
    transactionId: {
      type: String,
      trim: true,
    },
    month: {
      type: Number,
      required: [true, 'Please add month'],
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: [true, 'Please add year'],
      min: 2000,
      max: 2100,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot be more than 500 characters'],
    },
    payslipUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate payroll for same employee/month/year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

// Index for search and filtering
payrollSchema.index({ paymentStatus: 1, month: 1, year: 1 });
payrollSchema.index({ 'employee.employeeId': 1 });

// Pre-save middleware to calculate totals and net salary
payrollSchema.pre('save', function(next) {
  // Calculate total allowances
  this.totalAllowances = Object.values(this.allowances).reduce((sum, val) => sum + val, 0);
  
  // Calculate total deductions
  this.totalDeductions = Object.values(this.deductions).reduce((sum, val) => sum + val, 0);
  
  // Calculate net salary
  this.netSalary = this.basicSalary + 
                   this.totalAllowances + 
                   this.bonus + 
                   this.overtimePay - 
                   this.totalDeductions;
  
  // Ensure net salary is not negative
  if (this.netSalary < 0) {
    this.netSalary = 0;
  }
  
  next();
});

// Method to generate payslip number
payrollSchema.methods.generatePayslipNumber = function() {
  return `PS/${this.year}/${this.month.toString().padStart(2, '0')}/${this._id.toString().slice(-6)}`;
};

// Method to check if payroll is overdue
payrollSchema.methods.isOverdue = function() {
  if (this.paymentStatus === 'paid') return false;
  
  const currentDate = new Date();
  const paymentDueDate = new Date(this.year, this.month, 10); // 10th of next month
  return currentDate > paymentDueDate;
};

module.exports = mongoose.model('Payroll', payrollSchema);