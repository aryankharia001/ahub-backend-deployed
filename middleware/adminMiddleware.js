// middleware/admin.js
const User = require('../models/User');

// Middleware to check if user is an admin
module.exports = async function(req, res, next) {
  try {
    // User ID will be available from auth middleware
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }

    // Check if user is an admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin rights required.'
      });
    }

    next();
  } catch (error) {
    console.error('Error in admin middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
