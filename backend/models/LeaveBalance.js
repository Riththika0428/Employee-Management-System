const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      unique: true,
    },
    annual: {
      total: { type: Number, default: 20 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 20 },
    },
    casual: {
      total: { type: Number, default: 12 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 12 },
    },
    sick: {
      total: { type: Number, default: 12 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 12 },
    },
    unpaid: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
    },
    year: {
      type: Number,
      default: new Date().getFullYear(),
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Method to update leave balance
leaveBalanceSchema.methods.updateBalance = function(leaveType, days, isApproved = true) {
  if (!isApproved) return;
  
  const leaveTypes = ['annual', 'casual', 'sick', 'unpaid'];
  if (!leaveTypes.includes(leaveType)) return;
  
  this[leaveType].used += days;
  this[leaveType].remaining = this[leaveType].total - this[leaveType].used;
  this.lastUpdated = Date.now();
  
  return this.save();
};

// Method to check if sufficient balance exists
leaveBalanceSchema.methods.hasSufficientBalance = function(leaveType, days) {
  if (leaveType === 'unpaid') return true; // Unlimited unpaid leave
  return this[leaveType].remaining >= days;
};

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);