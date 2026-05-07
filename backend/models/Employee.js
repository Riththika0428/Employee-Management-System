const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please add a user reference'],
      unique: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Please add an employee ID'],
      unique: true,
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Please add department'],
      enum: ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Other'],
      default: 'IT',
    },
    position: {
      type: String,
      required: [true, 'Please add position'],
      trim: true,
    },
    salary: {
      type: Number,
      required: [true, 'Please add salary'],
      min: [0, 'Salary cannot be negative'],
    },
    joiningDate: {
      type: Date,
      required: [true, 'Please add joining date'],
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    contactNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate employee ID before saving
employeeSchema.pre('save', async function(next) {
  if (!this.employeeId) {
    // Generate employee ID: EMP + Year + 4-digit sequence
    const year = new Date().getFullYear();
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeId = `EMP${year}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Index for search functionality
employeeSchema.index({ employeeId: 'text', 'user.name': 'text' });

module.exports = mongoose.model('Employee', employeeSchema);