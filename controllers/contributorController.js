// Updated controllers/contributorController.js to handle revisions
const Job = require('../models/Job');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

exports.getAvailableJobs = async (req, res) => {
  try {
    const { category, limit = 10, page = 1 } = req.query;
    
    // Show jobs that have deposit paid and don't have a freelancer assigned
    const query = { 
      status: 'deposit_paid', // Only show jobs with deposits paid
      freelancer: null
    };
    
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
    console.error('Error in getAvailableJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get contributor's assigned jobs
exports.getMyJobs = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    
    const query = { freelancer: req.user.id };
    
    if (status) query.status = status;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 }
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
    console.error('Error in getMyJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.applyForJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    
    // Find the job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if job is available - updated to accept 'deposit_paid' status
    if (job.status !== 'deposit_paid') {
      return res.status(400).json({
        success: false,
        message: 'This job is not available for applications. Jobs must have deposit paid to be available.'
      });
    }
    
    // Check if job already has a freelancer
    if (job.freelancer) {
      return res.status(400).json({
        success: false,
        message: 'This job has already been assigned to another freelancer'
      });
    }
    
    // Assign the freelancer to the job and update status to 'in_progress'
    job.freelancer = req.user.id;
    job.status = 'in_progress';
    job.assignedAt = new Date();
    
    await job.save();
    
    // Notify client that their job has been picked
    // In a real app, send email/notification to client
    
    res.status(200).json({
      success: true,
      data: job,
      message: 'Job assigned successfully. You can now begin working on this job.'
    });
  } catch (error) {
    console.error('Error in applyForJob:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Submit initial work or revised work for a job
exports.submitWork = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { revisionId } = req.body;
    
    // Find the job
    const job = await Job.findById(jobId);
    
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  
    // Check if user is the freelancer assigned to this job
    if (job.freelancer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to submit work for this job' });
    }
    
    // Process uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    // Prepare file objects with watermarks
    const deliverables = req.files.map(file => ({
      name: file.originalname,
      url: `${req.protocol}://${req.get('host')}/uploads/contributor/${file.filename}`,
      type: file.mimetype,
      uploadedAt: new Date(),
      isWatermarked: true // Always watermark files until final payment
    }));
    
    // Handle revision submission if revisionId is provided
    if (revisionId) {
      // Check if job is in revision_requested status
      if (job.status !== 'revision_requested' && job.status !== 'revision_in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Can only submit revisions for jobs that have a revision requested'
        });
      }
      
      // Find the revision
      const revisionIndex = job.revisions.findIndex(
        rev => rev._id.toString() === revisionId
      );
      
      if (revisionIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Revision request not found'
        });
      }
      
      // Update the revision
      job.revisions[revisionIndex].status = 'completed';
      job.revisions[revisionIndex].completedAt = new Date();
      job.revisions[revisionIndex].freelancerNotes = req.body.message || '';
      job.revisions[revisionIndex].deliverables = deliverables;
      
      // Update job status
      job.status = 'revision_completed';
      
      await job.save();
      
      return res.status(200).json({
        success: true,
        data: job,
        message: 'Revision submitted successfully. The client will be notified to review the changes.'
      });
    } 
    // Handle initial submission
    else {
      // Check if job is in progress
      if (job.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Can only submit work for jobs that are in progress'
        });
      }
      
      // Clear existing deliverables if any
      job.deliverables = deliverables;
      
      // Update job status to completed
      job.status = 'completed';
      job.freelancerNote = req.body.message || '';
      
      await job.save();
      
      return res.status(200).json({
        success: true,
        data: job,
        message: 'Work submitted successfully. The client has been notified and can review your work.'
      });
    }
  } catch (error) {
    console.error('Error in submitWork:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Handle revision requests from client
exports.getRevisionRequests = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Find the job
    const job = await Job.findById(jobId)
      .populate('client', 'name email profilePicture');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if user is the freelancer assigned to this job
    if (job.freelancer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view revision requests for this job'
      });
    }
    
    // Return all revisions of the job
    res.status(200).json({
      success: true,
      data: {
        job: {
          _id: job._id,
          title: job.title,
          status: job.status,
          client: job.client
        },
        revisions: job.revisions,
        revisionsRemaining: job.revisionsRemaining
      }
    });
  } catch (error) {
    console.error('Error in getRevisionRequests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Start working on a revision
exports.startRevision = async (req, res) => {
  try {
    const { jobId, revisionId } = req.params;
    
    // Find the job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if user is the freelancer assigned to this job
    if (job.freelancer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to work on this job'
      });
    }
    
    // Check if job is in revision_requested status
    if (job.status !== 'revision_requested') {
      return res.status(400).json({
        success: false,
        message: 'Can only start work on revisions that have been requested'
      });
    }
    
    // Find the revision
    const revisionIndex = job.revisions.findIndex(
      rev => rev._id.toString() === revisionId
    );
    
    if (revisionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Revision request not found'
      });
    }
    
    // Update the revision status
    job.revisions[revisionIndex].status = 'in_progress';
    job.status = 'revision_in_progress';
    
    await job.save();
    
    res.status(200).json({
      success: true,
      data: job,
      message: 'You have started working on this revision.'
    });
  } catch (error) {
    console.error('Error in startRevision:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get contributor dashboard statistics
exports.getContributorStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get count of current jobs
    const activeJobsCount = await Job.countDocuments({
      freelancer: userId,
      status: { $in: ['in_progress', 'revision_requested', 'revision_in_progress'] }
    });
    
    // Get count of completed jobs
    const completedJobsCount = await Job.countDocuments({
      freelancer: userId,
      status: { $in: ['completed', 'revision_completed', 'approved_by_client', 'final_paid'] }
    });
    
    // Get count of jobs with revision requests
    const revisionRequestsCount = await Job.countDocuments({
      freelancer: userId,
      status: 'revision_requested'
    });
    
    // Get total earnings
    const completedJobs = await Job.find({
      freelancer: userId,
      status: 'final_paid'
    });
    
    const totalEarnings = completedJobs.reduce((sum, job) => sum + (job.price || 0), 0);
    
    // Get available jobs count
    const availableJobsCount = await Job.countDocuments({
      status: 'deposit_paid',
      freelancer: null
    });
    
    res.status(200).json({
      success: true,
      data: {
        activeJobs: activeJobsCount,
        completedJobs: completedJobsCount,
        revisionRequests: revisionRequestsCount,
        totalEarnings,
        availableJobs: availableJobsCount
      }
    });
  } catch (error) {
    console.error('Error in getContributorStats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;