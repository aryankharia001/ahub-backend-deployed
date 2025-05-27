// controllers/jobController.js
const Job = require('../models/Job');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

// In jobController.js - createJob function (leave as pending)
exports.createJob = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('req.body : ', req.body);

    const { title, description, deadline, category, skills, visibility, contributorPrice } = req.body;

    // Create job with status 'pending' for admin review
    const job = new Job({
      title,
      description,
      deadline,
      category,
      skills: skills || [],
      visibility: visibility || 'public',
      client: req.user.id,
      status: 'pending', // Admin needs to review and set price
      contributorPrice,
    });

    await job.save();

    res.status(201).json({
      success: true,
      data: job,
      message: 'Job posted successfully and is pending admin review'
    });
  } catch (error) {
    console.error('Error in createJob:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const { status, category, limit = 10, page = 1 } = req.query;
    
    const query = { status: 'approved' }; // Only show approved jobs by default
    
    if (category) query.category = category;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const jobs = await Job.find(query, null, options)
      .populate('client', 'name email profilePicture ratings')
      .lean();
    
    const total = await Job.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: jobs
    });
  } catch (error) {
    console.error('Error in getAllJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'name email profilePicture ratings');
      
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error in getJobById:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if user is the job owner
    if (job.client.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }
    
    // Only allow updates if job is still pending
    if (job.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a job that has been reviewed by admin'
      });
    }
    
    const { title, description, deadline, category, skills, visibility } = req.body;
    
    job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        deadline,
        category,
        skills: skills || job.skills,
        visibility: visibility || job.visibility
      },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: job,
      message: 'Job updated successfully'
    });
  } catch (error) {
    console.error('Error in updateJob:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if user is the job owner
    if (job.client.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }
    
    // Only allow deletion if job is still pending or rejected
    if (!['pending', 'rejected'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a job that is already approved or in progress'
      });
    }
    
    await job.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteJob:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



/**
 * Update job status to completed when no revision is required
 * @route PUT /api/jobs/:id/no-revision-required
 * @access Private - Client only
 */
exports.noRevisionRequired = async (req, res) => {
  try {
    // Find job by ID with validation
    const jobId = req.params.id;

    // Find the job and check if it exists
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Authorization check - make sure the current user is the client for this job
    if (job.client.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this job'
      });
    }

    // Validate current job status
    if (job.status !== 'final_paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete job - invalid current status'
      });
    }

    // Update job status to job_end
    job.status = 'job_end';
    job.completedAt = new Date();
    job.lastUpdatedBy = req.userId;


    // Save the updated job
    await job.save();

    // Return the updated job data
    res.status(200).json({
      success: true,
      message: 'Job successfully marked as completed',
      data: job
    });
    
  } catch (error) {
    console.error('Error in noRevisionRequired controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating job status',
      error: error.message
    });
  }
};




exports.revisionRequired = async (req, res) => {
  const job = await Job.findById(req.params.id);

  // console.log('job : ',job);

  job.status = req.body.status;

  await job.save();
}




exports.reviewJob = async (req, res) => {
  try {
    const { status, price, adminFeedback, contributorPrice } = req.body;
    
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Only allow review if job is still pending
    if (job.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This job has already been reviewed'
      });
    }
    
    // Update job with admin review
    job = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status,
        price: status === 'approved' ? price : null,
        adminFeedback,
        contributorPrice
      },
      { new: true }
    );
    
    // Here you would typically send a notification to the client
    
    res.status(200).json({
      success: true,
      data: job,
      message: `Job ${status === 'approved' ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Error in reviewJob:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get admin jobs with filtering and sorting
exports.getAdminJobs = async (req, res) => {
  try {
    const { status, search, sortBy = 'createdAt', sortOrder = 'desc', limit = 10, page = 1 } = req.query;
    
    // Build query object
    const query = {};
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Options for pagination and sorting
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
    };
    
    // Execute query
    const jobs = await Job.find(query, null, options)
      .populate('client', 'name email profilePicture')
      .lean();
    
    const total = await Job.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: jobs
    });
  } catch (error) {
    console.error('Error in getAdminJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.acceptJobOffer = async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if user is the job owner
    if (job.client.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept this job offer'
      });
    }
    
    // Only allow acceptance if job is approved
    if (job.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only accept jobs that have been approved by admin'
      });
    }
    
    // Instead of immediately setting to in_progress, redirect to deposit payment
    return res.status(200).json({
      success: true,
      data: job,
      message: 'Job offer can be accepted. Please proceed to make the deposit payment.',
      nextStep: 'deposit_payment',
      depositAmount: job.depositAmount
    });
  } catch (error) {
    console.error('Error in acceptJobOffer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getMyJobs = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    
    const query = { client: req.user.id };
    
    if (status) query.status = status;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const jobs = await Job.find(query, null, options).lean();
    
    const total = await Job.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: jobs
    });
  } catch (error) {
    console.error('Error in getMyJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getPendingJobs = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    const query = { status: 'pending' };
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: 1 } // Oldest first, to be fair to clients who waited longer
    };
    
    const jobs = await Job.find(query, null, options)
      .populate('client', 'name email profilePicture')
      .lean();
    
    const total = await Job.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: jobs
    });
  } catch (error) {
    console.error('Error in getPendingJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.markJobAsCompleted = async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if job is in progress
    if (job.status !== 'deposit_paid' && job.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Can only complete jobs that are in progress or have deposits paid'
      });
    }
    
    // Update job status to completed
    job = await Job.findByIdAndUpdate(
      req.params.id,
      { status: 'completed' },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: job,
      message: 'Job marked as completed'
    });
  } catch (error) {
    console.error('Error in markJobAsCompleted:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Deliver job with watermarked deliverables (Admin only)
exports.deliverJob = async (req, res) => {
  try {
    // Get job
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if job is completed
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only deliver jobs that are completed'
      });
    }
    
    // Process uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    // Format deliverable objects
    const deliverables = req.files.map(file => {
      // Generate URL based on server configuration
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/watermarked/${file.filename}`;
      
      return {
        name: file.originalname,
        url: fileUrl,
        type: file.mimetype,
        isWatermarked: true,
        uploadedAt: new Date()
      };
    });
    
    // Update job with deliverables and change status
    job = await Job.findByIdAndUpdate(
      req.params.id,
      { 
        deliverables,
        status: 'delivered',
        adminNote: req.body.note || ''
      },
      { new: true }
    );
    
    // In a real app, you would send a notification to the client here
    
    res.status(200).json({
      success: true,
      data: job,
      message: 'Job delivered successfully with watermarked files. Client can now review and make final payment.'
    });
  } catch (error) {
    console.error('Error in deliverJob:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Deliver final unwatermarked files (Admin only)
exports.deliverFinalFiles = async (req, res) => {
  try {
    // Get job
    let job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if final payment has been made
    if (job.status !== 'final_paid') {
      return res.status(400).json({
        success: false,
        message: 'Can only deliver final files for jobs that have been fully paid'
      });
    }
    
    // Process uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    // Format deliverable objects
    const deliverables = req.files.map(file => {
      // Generate URL based on server configuration
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/final/${file.filename}`;
      
      return {
        name: file.originalname,
        url: fileUrl,
        type: file.mimetype,
        isWatermarked: false,
        uploadedAt: new Date()
      };
    });
    
    // Update job with final deliverables
    job = await Job.findByIdAndUpdate(
      req.params.id,
      { 
        deliverables,
        adminNote: req.body.note || job.adminNote
      },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: job,
      message: 'Final deliverables provided successfully'
    });
  } catch (error) {
    console.error('Error in deliverFinalFiles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};