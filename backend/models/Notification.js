const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please add recipient'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please add title'],
      trim: true,
      maxlength: [200, 'Title cannot be more than 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Please add message'],
      trim: true,
      maxlength: [1000, 'Message cannot be more than 1000 characters'],
    },
    type: {
      type: String,
      enum: ['task', 'leave', 'payroll', 'attendance', 'system', 'employee'],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relatedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    actionUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// Index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);