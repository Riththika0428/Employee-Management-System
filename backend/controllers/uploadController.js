const EmployeeDocument = require('../models/EmployeeDocument');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { deleteFromCloudinary, getOptimizedUrl } = require('../utils/cloudinary');
const sharp = require('sharp');

// Helper function to compress image (optional)
const compressImage = async (buffer, options = {}) => {
  try {
    const { width = 800, quality = 80 } = options;
    const compressed = await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    return compressed;
  } catch (error) {
    console.error('Image compression error:', error);
    return buffer;
  }
};

// @desc    Upload profile image
// @route   POST /api/uploads/profile-image
// @access  Private
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file',
      });
    }
    
    // Get employee record
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    // Check if employee already has a profile image
    const existingImage = await EmployeeDocument.findOne({
      employee: employee._id,
      category: 'profile-image',
      isActive: true,
    });
    
    let fileData = {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
    };
    
    // If using Cloudinary
    if (req.file.path) {
      fileData = {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        publicId: req.file.filename,
        url: req.file.path,
      };
    }
    
    // Create document record
    const document = await EmployeeDocument.create({
      employee: employee._id,
      fileName: req.file.originalname,
      originalName: req.file.originalname,
      fileUrl: fileData.url || fileData.path,
      publicId: fileData.publicId || fileData.filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      category: 'profile-image',
      uploadedBy: req.user.id,
      metadata: {
        originalName: req.file.originalname,
      },
    });
    
    // Delete old profile image if exists
    if (existingImage) {
      // Delete from Cloudinary
      if (existingImage.publicId) {
        await deleteFromCloudinary(existingImage.publicId);
      }
      // Mark as inactive instead of deleting
      existingImage.isActive = false;
      await existingImage.save();
    }
    
    // Populate uploader details
    const populatedDocument = await EmployeeDocument.findById(document._id)
      .populate('uploadedBy', 'name email')
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: populatedDocument,
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

// @desc    Upload employee document
// @route   POST /api/uploads/document
// @access  Private (Admin/HR can upload for others)
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file',
      });
    }
    
    const { employeeId, category, description } = req.body;
    
    let employee;
    
    // Determine employee based on role
    if (req.user.role === 'employee') {
      // Employee can only upload for themselves
      employee = await Employee.findOne({ user: req.user.id });
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found',
        });
      }
    } else {
      // Admin/HR can upload for any employee
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Please provide employee ID',
        });
      }
      
      employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found',
        });
      }
    }
    
    // Validate category
    const validCategories = ['resume', 'certificate', 'id-proof', 'contract', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Allowed: ${validCategories.join(', ')}`,
      });
    }
    
    // Create document record
    const document = await EmployeeDocument.create({
      employee: employee._id,
      fileName: req.file.originalname,
      originalName: req.file.originalname,
      fileUrl: req.file.path,
      publicId: req.file.filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      category,
      uploadedBy: req.user.id,
      description: description || '',
      metadata: {
        originalName: req.file.originalname,
      },
    });
    
    const populatedDocument = await EmployeeDocument.findById(document._id)
      .populate('uploadedBy', 'name email')
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: populatedDocument,
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

// @desc    Upload multiple documents
// @route   POST /api/uploads/documents/bulk
// @access  Private (Admin/HR only)
const uploadMultipleDocuments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one file',
      });
    }
    
    const { employeeId, category } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employee ID',
      });
    }
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    const documents = [];
    
    for (const file of req.files) {
      const document = await EmployeeDocument.create({
        employee: employee._id,
        fileName: file.originalname,
        originalName: file.originalname,
        fileUrl: file.path,
        publicId: file.filename,
        fileType: file.mimetype,
        fileSize: file.size,
        category: category || 'other',
        uploadedBy: req.user.id,
      });
      
      documents.push(document);
    }
    
    const populatedDocuments = await EmployeeDocument.find({
      _id: { $in: documents.map(d => d._id) },
    })
      .populate('uploadedBy', 'name email')
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    res.status(201).json({
      success: true,
      message: `${documents.length} documents uploaded successfully`,
      count: documents.length,
      data: populatedDocuments,
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

// @desc    Get my documents (Employee)
// @route   GET /api/uploads/my-documents
// @access  Private
const getMyDocuments = async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found',
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    let query = { employee: employee._id, isActive: true };
    
    // Filter by category
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    const documents = await EmployeeDocument.find(query)
      .populate('uploadedBy', 'name email')
      .sort('-uploadedAt')
      .skip(skip)
      .limit(limit);
    
    const total = await EmployeeDocument.countDocuments(query);
    
    // Group by category for summary
    const categorySummary = await EmployeeDocument.aggregate([
      { $match: { employee: employee._id, isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      count: documents.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      categorySummary,
      data: documents,
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

// @desc    Get employee documents (Admin/HR)
// @route   GET /api/uploads/employee/:employeeId
// @access  Private (Admin/HR only)
const getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const employee = await Employee.findById(employeeId)
      .populate('user', 'name email');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    let query = { employee: employeeId, isActive: true };
    
    // Filter by category
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    const documents = await EmployeeDocument.find(query)
      .populate('uploadedBy', 'name email')
      .sort('-uploadedAt')
      .skip(skip)
      .limit(limit);
    
    const total = await EmployeeDocument.countDocuments(query);
    
    // Get document statistics
    const stats = await EmployeeDocument.aggregate([
      { $match: { employee: employee._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          categories: { $addToSet: '$category' },
        },
      },
    ]);
    
    res.status(200).json({
      success: true,
      employee: {
        id: employee._id,
        name: employee.user.name,
        email: employee.user.email,
        employeeId: employee.employeeId,
        department: employee.department,
      },
      count: documents.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statistics: stats[0] || null,
      data: documents,
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

// @desc    Get single document by ID
// @route   GET /api/uploads/:id
// @access  Private
const getDocumentById = async (req, res) => {
  try {
    const document = await EmployeeDocument.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email',
        },
      });
    
    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || document.employee._id.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this document',
        });
      }
    }
    
    // Generate optimized URL for images
    let optimizedUrl = document.fileUrl;
    if (document.fileType.startsWith('image/') && document.publicId) {
      optimizedUrl = getOptimizedUrl(document.publicId, { width: 800 });
    }
    
    res.status(200).json({
      success: true,
      data: {
        ...document.toObject(),
        optimizedUrl,
        downloadUrl: `/api/uploads/${document._id}/download`,
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

// @desc    Download document
// @route   GET /api/uploads/:id/download
// @access  Private
const downloadDocument = async (req, res) => {
  try {
    const document = await EmployeeDocument.findById(req.params.id);
    
    if (!document || !document.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || document.employee.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to download this document',
        });
      }
    }
    
    // Redirect to Cloudinary URL for download
    res.redirect(document.fileUrl);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete document
// @route   DELETE /api/uploads/:id
// @access  Private
const deleteDocument = async (req, res) => {
  try {
    const document = await EmployeeDocument.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }
    
    // Check authorization
    const employee = await Employee.findOne({ user: req.user.id });
    
    if (req.user.role === 'employee') {
      if (!employee || document.employee.toString() !== employee._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this document',
        });
      }
    }
    
    // Delete from Cloudinary
    if (document.publicId) {
      await deleteFromCloudinary(document.publicId);
    }
    
    // Soft delete or permanent delete
    if (req.query.permanent === 'true' && req.user.role !== 'employee') {
      await document.deleteOne();
    } else {
      document.isActive = false;
      await document.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
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

// @desc    Get upload statistics
// @route   GET /api/uploads/stats
// @access  Private (Admin/HR only)
const getUploadStats = async (req, res) => {
  try {
    const totalDocuments = await EmployeeDocument.countDocuments({ isActive: true });
    const totalSize = await EmployeeDocument.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } },
    ]);
    
    const categoryStats = await EmployeeDocument.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
        },
      },
    ]);
    
    const recentUploads = await EmployeeDocument.find({ isActive: true })
      .populate('uploadedBy', 'name')
      .sort('-uploadedAt')
      .limit(10);
    
    res.status(200).json({
      success: true,
      data: {
        totalDocuments,
        totalSize: totalSize[0]?.total || 0,
        totalSizeReadable: formatBytes(totalSize[0]?.total || 0),
        categoryStats,
        recentUploads,
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

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
  uploadProfileImage,
  uploadDocument,
  uploadMultipleDocuments,
  getMyDocuments,
  getEmployeeDocuments,
  getDocumentById,
  downloadDocument,
  deleteDocument,
  getUploadStats,
};