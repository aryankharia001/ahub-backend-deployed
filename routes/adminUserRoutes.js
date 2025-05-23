// routes/adminUserRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const adminUserController = require('../controllers/adminUserController');
const adminMiddleware = require('../middleware/adminMiddleware');

// All routes in this file require authentication and admin role
router.use(authMiddleware, adminMiddleware);

// Get all users with pagination and filtering
router.get('/users', adminUserController.getAllUsers);

// Get a single user by ID
router.get('/users/:id', adminUserController.getUserById);

// Update a user's role
router.put(
  '/users/:id/role',
  [
    body('role')
      .isIn(['client', 'contributor', 'admin'])
      .withMessage('Role must be client, contributor, or admin')
  ],
  adminUserController.updateUserRole
);

// Deactivate a user account
router.put('/users/:id/deactivate', adminUserController.deactivateUser);

// Reactivate a user account
router.put('/users/:id/reactivate', adminUserController.reactivateUser);

module.exports = router;