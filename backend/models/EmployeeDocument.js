const mongoose = require('mongoose');

const employeeDocumentSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Please add employee reference'],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'Please add file name'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Please add original file name'],
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'Please add file URL'],
    },
    publicId: {
      type: String,
      required: [true, 'Please add Cloudinary public ID'],
    },
    fileType: {
      type: String,
      required: [true, 'Please add file type'],
    },
    fileSize: {
      type: Number,
      required: [true, 'Please add file size'],
    },
    category: {
      type: String,
      enum: ['profile-image', 'resume', 'certificate', 'id-proof', 'contract', 'other'],
      required: [true, 'Please add document category'],
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please add uploader reference'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      width: Number,
      height: Number,
      format: String,
      originalName: String,
    },
  },
  {
    timestamps: {
      createdAt: 'uploadedAt',
      updatedAt: 'updatedAt',
    },
  }
);

// Index for efficient queries
employeeDocumentSchema.index({ employee: 1, category: 1 });
employeeDocumentSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);