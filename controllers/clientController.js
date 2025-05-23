// Updated controllers/clientController.js to handle revision requests and approvals
const Job = require('../models/Job');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

exports.getClientJobs = async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    
    const query = { client: req.user.id };
    
    if (status) query.status = status;
    
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const jobs = await Job.find(query, null, options)
      .populate('freelancer', 'name email profilePicture')
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
    console.error('Error in getClientJobs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Handle client's review of submitted work
exports.reviewSubmittedWork = async (req, res) => {
    try {
      const { id } = req.params;
      const { action, feedback } = req.body;

      console.log("id : ", req.body);
      
      // Find the job
      const job = await Job.findById(id);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }
      
      // Check if user is the client
      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to review this job'
        });
      }
      
      
      console.log("action : ", action);

      // Handle client's decision
      if (action === 'approve') {
        // Mark job as approved by client
        job.clientApproved = true;
        job.status = 'job_end';
        job.clientFeedback = feedback || 'Work approved';
        job.clientApprovedAt = new Date();
        
        await job.save();
        
        return res.status(200).json({
          success: true,
          message: 'You have approved the work. You can now proceed to make the final payment to get unwatermarked files.',
          data: job
        });
      } else if (action === 'request_revision') {
        // Check if client has any revisions remaining
        if (job.revisionsRemaining <= 0) {
          return res.status(400).json({
            success: false,
            message: 'You have used all your revision requests for this job.'
          });
        }

        console.log("action 2 : ", job);
        
        // Create a new revision request
        const newRevision = {
          requestedAt: new Date(),
          clientNotes: feedback || 'Revision requested',
          status: 'requested'
        };
        
        // Add the revision to the job
        job.revisions.push(newRevision);
        job.revisionsRemaining -= 1;
        job.status = 'revision_requested';
        
        await job.save();
        
        return res.status(200).json({
          success: true,
          message: 'Revision request has been sent to the contributor.',
          revisionsRemaining: job.revisionsRemaining,
          data: job
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Must be either "approve" or "request_revision".'
        });
      }
    } catch (error) {
      console.error('Error in reviewSubmittedWork:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

// Get client dashboard statistics
exports.getClientStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get count of current jobs
    const activeJobsCount = await Job.countDocuments({
      client: userId,
      status: { $in: ['deposit_paid', 'in_progress', 'revision_requested', 'revision_in_progress'] }
    });
    
    // Get count of completed jobs
    const completedJobsCount = await Job.countDocuments({
      client: userId,
      status: { $in: ['completed', 'revision_completed', 'approved_by_client', 'final_paid'] }
    });
    
    // Get count of pending review jobs
    const pendingReviewCount = await Job.countDocuments({
      client: userId,
      status: { $in: ['completed', 'revision_completed'] }
    });
    
    // Get total spending
    const paidJobs = await Job.find({
      client: userId,
      status: 'final_paid'
    });
    
    const totalSpent = paidJobs.reduce((sum, job) => sum + (job.price || 0), 0);
    
    res.status(200).json({
      success: true,
      data: {
        activeJobs: activeJobsCount,
        completedJobs: completedJobsCount,
        pendingReview: pendingReviewCount,
        totalSpent
      }
    });
  } catch (error) {
    console.error('Error in getClientStats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;