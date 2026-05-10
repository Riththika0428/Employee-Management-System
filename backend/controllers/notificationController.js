const Notification = require('../models/Notification');
const { getUnreadCount } = require('../services/notificationService');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const query = { recipient: req.user.id };
    
    // Filter by read status
    if (req.query.isRead === 'true') {
      query.isRead = true;
    } else if (req.query.isRead === 'false') {
      query.isRead = false;
    }
    
    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await getUnreadCount(req.user.id);
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: notifications,
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

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id,
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    
    if (notification.isRead) {
      return res.status(400).json({
        success: false,
        message: 'Notification already marked as read',
      });
    }
    
    notification.isRead = true;
    await notification.save();
    
    // Get updated unread count
    const unreadCount = await getUnreadCount(req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      unreadCount,
      data: notification,
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

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    
    const unreadCount = await getUnreadCount(req.user.id);
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      unreadCount,
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

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    
    const unreadCount = await getUnreadCount(req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      unreadCount,
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

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
const getNotificationStats = async (req, res) => {
  try {
    const unreadCount = await getUnreadCount(req.user.id);
    
    const typeStats = await Notification.aggregate([
      { $match: { recipient: req.user._id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
          },
        },
      },
    ]);
    
    const recentNotifications = await Notification.find({ recipient: req.user.id })
      .sort('-createdAt')
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        unreadCount,
        typeStats,
        recentNotifications,
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

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats,
};