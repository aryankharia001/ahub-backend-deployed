const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');  // Added job routes
const adminUserRoutes = require('./routes/adminUserRoutes');
// Add other routes as they're created
// const userRoutes = require('./routes/userRoutes');

// Initialize express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow cross-origin resource sharing
}));

// CORS configuration
// Update your CORS configuration in server.js
const corsOptions = {
  origin: [
    'https://ahub-frontend-deployed-git-main-aryans-projects-dd777310.vercel.app',
    'https://ahub-frontend-deployed.vercel.app',
    'http://localhost:5173' // For local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes (these should come before static file serving)
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);  // Added job routes
app.use('/api/admin', adminUserRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Root API route
app.get('/api', (req, res) => {
  res.json({
    message: 'ahub API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      jobs: '/api/jobs',  // Added job endpoints
      health: '/health'
    }
  });
});

// Serve static files from the frontend dist folder
// This assumes your frontend build is in a 'dist' folder
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all handler: send back React's index.html file for any non-API routes
// This is essential for single-page applications with client-side routing
app.get('*', (req, res, next) => {
  // Skip API routes and specific file requests
  if (req.originalUrl.startsWith('/api/') || 
      req.originalUrl.startsWith('/uploads/') || 
      req.originalUrl.startsWith('/health')) {
    return next();
  }
  
  // Serve the frontend's index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      next(err);
    }
  });
});

// 404 handler for API routes and other resources
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  
  res.json({
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    })
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  
  // Start server after database connection
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend available at http://localhost:${PORT}`);
  });
  
  // Make server available for graceful shutdown
  app.set('server', server);
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  const server = app.get('server');
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  const server = app.get('server');
  if (server) {
    server.close(() => {
      console.log('Process terminated');
    });
  }
});

module.exports = app;