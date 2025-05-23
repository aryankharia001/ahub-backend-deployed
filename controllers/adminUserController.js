// controllers/adminUserController.js
const User = require('../models/User');
const { validationResult } = require('express-validator');

/**
 * Get all users with pagination and filtering
 * @route GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter query
    const filter = {};
    
    // Filter by role if specified
    if (req.query.role && req.query.role !== 'all') {
      filter.role = req.query.role;
    }
    
    // Search by text if provided
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { _id: req.query.search.length === 24 ? req.query.search : null } // Only search by ID if it looks like a valid ObjectId
      ];
    }
    
    // Execute the query with pagination
    const users = await User.find(filter)
      .select('_id name email role createdAt updatedAt profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    
    return res.status(200).json({
      success: true,
      data: users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get a single user by ID
 * @route GET /api/admin/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError' && error.path === '_id') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a user's role
 * @route PUT /api/admin/users/:id/role
 */
exports.updateUserRole = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        message: 'Validation error'
      });
    }
    
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['client', 'contributor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Role must be client, contributor, or admin'
      });
    }
    
    // Find and update the user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent changing role of the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change role of the last admin user'
        });
      }
    }
    
    // Update the user's role
    user.role = role;
    await user.save();
    
    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      message: `User role updated to ${role} successfully`
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError' && error.path === '_id') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Deactivate a user account
 * @route PUT /api/admin/users/:id/deactivate
 */
exports.deactivateUser = async (req, res) => {
  try {
    // Find the user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent deactivating your own account
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }
    
    // Prevent deactivating the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last admin user'
        });
      }
    }
    
    // Update user status to inactive
    user.status = 'inactive';
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'User account deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError' && error.path === '_id') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reactivate a user account
 * @route PUT /api/admin/users/:id/reactivate
 */
exports.reactivateUser = async (req, res) => {
  try {
    // Find the user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update user status to active
    user.status = 'active';
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'User account reactivated successfully'
    });
  } catch (error) {
    console.error('Error reactivating user:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError' && error.path === '_id') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};