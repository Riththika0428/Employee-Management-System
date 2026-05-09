const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a task title'],
      trim: true,
      maxlength: [200, 'Title cannot be more than 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a task description'],
      trim: true,
      maxlength: [2000, 'Description cannot be more than 2000 characters'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Please assign task to an employee'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify who assigned the task'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    deadline: {
      type: Date,
      required: [true, 'Please add a deadline'],
    },
    completedAt: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot be more than 500 characters'],
    },
    attachments: [
      {
        filename: String,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [String],
    estimatedHours: {
      type: Number,
      min: 0,
      max: 100,
    },
    actualHours: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search and filtering
taskSchema.index({ title: 'text', description: 'text', tags: 'text' });
taskSchema.index({ status: 1, priority: 1, deadline: 1 });
taskSchema.index({ assignedTo: 1, assignedBy: 1 });

// Pre-save middleware to validate deadline
taskSchema.pre('save', function(next) {
  if (this.deadline && this.deadline < new Date()) {
    next(new Error('Deadline cannot be in the past'));
  }
  next();
});

// Method to check if task is overdue
taskSchema.methods.isOverdue = function() {
  return this.deadline < new Date() && this.status !== 'completed';
};

// Method to get task progress
taskSchema.methods.getProgress = function() {
  const progressMap = {
    'pending': 0,
    'in-progress': 50,
    'completed': 100,
    'cancelled': 0,
  };
  return progressMap[this.status];
};

module.exports = mongoose.model('Task', taskSchema);