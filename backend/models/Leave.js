const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Please add employee reference'],
    },
    leaveType: {
      type: String,
      enum: ['sick', 'casual', 'annual', 'unpaid', 'maternity', 'paternity', 'bereavement'],
      required: [true, 'Please select leave type'],
    },
    startDate: {
      type: Date,
      required: [true, 'Please add start date'],
    },
    endDate: {
      type: Date,
      required: [true, 'Please add end date'],
    },
    totalDays: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      required: [true, 'Please provide reason for leave'],
      trim: true,
      maxlength: [500, 'Reason cannot be more than 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [300, 'Rejection reason cannot be more than 300 characters'],
    },
    attachment: {
      filename: String,
      url: String,
    },
    contactInfo: {
      phone: String,
      emergencyContact: String,
    },
    substituteEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ startDate: -1, endDate: -1 });
leaveSchema.index({ status: 1, leaveType: 1 });

// Pre-save middleware to calculate total days
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    
    // Calculate number of days (excluding time)
    const timeDiff = Math.abs(end.getTime() - start.getTime());
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    this.totalDays = dayDiff + 1; // Include both start and end date
  }
  next();
});

// Method to check if leave dates are valid
leaveSchema.methods.isValidDates = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Cannot apply for past dates
  if (this.startDate < today) {
    return { valid: false, message: 'Cannot apply for past dates' };
  }
  
  // End date must be after start date
  if (this.endDate < this.startDate) {
    return { valid: false, message: 'End date must be after start date' };
  }
  
  // Maximum 30 days leave at a time
  if (this.totalDays > 30) {
    return { valid: false, message: 'Cannot apply for more than 30 days at once' };
  }
  
  return { valid: true };
};

// Method to check overlapping leaves
leaveSchema.methods.isOverlapping = async function(employeeId, startDate, endDate, excludeId = null) {
  const query = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: endDate, $gte: startDate } },
      { endDate: { $lte: endDate, $gte: startDate } },
      {
        startDate: { $lte: startDate },
        endDate: { $gte: endDate },
      },
    ],
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const overlappingLeave = await mongoose.model('Leave').findOne(query);
  return !!overlappingLeave;
};

module.exports = mongoose.model('Leave', leaveSchema);