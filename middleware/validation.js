const { validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg
      }))
    });
  }
  
  next();
};

// Common validation rules
const validationRules = {
  email: {
    in: ['body'],
    isEmail: {
      errorMessage: 'Please provide a valid email address'
    },
    normalizeEmail: true,
    trim: true
  },
  
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Password must be at least 6 characters long'
    },
    matches: {
      options: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])/,
      errorMessage: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
  },
  
  name: {
    in: ['body'],
    trim: true,
    notEmpty: {
      errorMessage: 'Name is required'
    },
    isLength: {
      options: { min: 2, max: 50 },
      errorMessage: 'Name must be between 2 and 50 characters'
    }
  },
  
  phone: {
    in: ['body'],
    optional: { options: { nullable: true } },
    matches: {
      options: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
      errorMessage: 'Please provide a valid phone number'
    }
  },
  
  role: {
    in: ['body'],
    isIn: {
      options: [['client', 'contributor', 'admin']],
      errorMessage: 'Invalid role specified'
    }
  }
};

module.exports = {
  handleValidationErrors,
  validationRules
};