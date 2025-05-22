// Updated controllers/contributorController.js to handle revisions
const Job = require('../models/Job');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const { uploadFileToDrive } = require('../utils/googleDriveService');

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
// controllers/jobController.js - Updated submitWork function

// Updated submitWork Controller to support both local uploads and Google Drive files
// exports.submitWork = async (req, res) => {
//   try {
//     const jobId = req.params.id;
//     const { revisionId, uploadSource } = req.body;
    
//     // Find the job
//     const job = await Job.findById(jobId);
    
//     if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    
//     // Check if user is the freelancer assigned to this job
//     if (job.freelancer.toString() !== req.user.id) {
//       return res.status(403).json({ success: false, message: 'Not authorized to submit work for this job' });
//     }
    
//     let deliverables = [];
    
//     // Handle Google Drive files if that's the upload source
//     if (uploadSource === 'drive' && req.body.driveFiles) {
//       try {
//         // Parse driveFiles if it's a string
//         const driveFilesData = typeof req.body.driveFiles === 'string' 
//           ? JSON.parse(req.body.driveFiles) 
//           : req.body.driveFiles;
          
//         // Process Google Drive files
//         deliverables = driveFilesData.map(file => ({
//           name: file.name,
//           url: `https://drive.google.com/file/d/${file.id}/view`,
//           downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
//           type: file.mimeType
//         }));
//       } catch (error) {
//         console.error('Error processing Google Drive files:', error);
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Error processing Google Drive files' 
//         });
//       }
//     } 
//     // Handle regular file uploads
//     else if (req.files && req.files.length > 0) {
//       // Upload files to Google Drive
//       const uploadPromises = req.files.map(async (file) => {
//         // Create a folder for this job
//         const folderName = `Job_${job._id}_${job.title.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
//         // Upload to Google Drive
//         const uploadedFile = await uploadFileToDrive(file, folderName);
        
//         return {
//           name: file.originalname,
//           url: uploadedFile.viewUrl,      // URL to view the file in Google Drive
//           downloadUrl: uploadedFile.downloadUrl, // URL to download the file
//           type: file.mimetype
//         };
//       });
      
//       // Wait for all uploads to complete
//       deliverables = await Promise.all(uploadPromises);
//     } 
//     // No files uploaded and not using Google Drive
//     else {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'No files uploaded' 
//       });
//     }
    
//     // Handle revision submission if revisionId is provided
//     if (revisionId) {
//       // Check if job is in revision_requested status
//       if (job.status !== 'revision_requested' && job.status !== 'revision_in_progress') {
//         return res.status(400).json({
//           success: false,
//           message: 'Can only submit revisions for jobs that have a revision requested'
//         });
//       }
      
//       // Find the revision
//       const revisionIndex = job.revisions.findIndex(
//         rev => rev._id.toString() === revisionId
//       );
      
//       if (revisionIndex === -1) {
//         return res.status(404).json({
//           success: false,
//           message: 'Revision request not found'
//         });
//       }
      
//       // Update the revision
//       job.revisions[revisionIndex].status = 'completed';
//       job.revisions[revisionIndex].completedAt = new Date();
//       job.revisions[revisionIndex].freelancerNotes = req.body.message || '';
//       job.revisions[revisionIndex].deliverables = deliverables;
      
//       // Update job status
//       job.status = 'revision_completed';
      
//       await job.save();
      
//       return res.status(200).json({
//         success: true,
//         data: job,
//         message: 'Revision submitted successfully. The client will be notified to review the changes.'
//       });
//     }
//     // Handle initial submission
//     else {
//       // Check if job is in progress
//       if (job.status !== 'in_progress') {
//         return res.status(400).json({
//           success: false,
//           message: 'Can only submit work for jobs that are in progress'
//         });
//       }
      
//       // Update deliverables with Google Drive URLs
//       job.deliverables = deliverables;
      
//       // Update job status to completed
//       job.status = 'completed';
//       job.freelancerNote = req.body.message || '';
      
//       await job.save();
      
//       return res.status(200).json({
//         success: true,
//         data: job,
//         message: 'Work submitted successfully. The client has been notified and can review your work.'
//       });
//     }
//   } catch (error) {
//     console.error('Error in submitWork:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

// exports.submitWork = async (req, res) => {
//   try {
//     const jobId = req.params.id;
//     const { revisionId } = req.body;
    
//     // Find the job
//     const job = await Job.findById(jobId);
    
//     if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    
//     // Check if user is the freelancer assigned to this job
//     if (job.freelancer.toString() !== req.user.id) {
//       return res.status(403).json({ success: false, message: 'Not authorized to submit work for this job' });
//     }
    
//     // Process uploaded files
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ success: false, message: 'No files uploaded' });
//     }
    
//     // Upload files to Google Drive
//     const uploadPromises = req.files.map(async (file) => {
//       // Create a folder for this job
//       const folderName = `Job_${job._id}_${job.title.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
//       // Upload to Google Drive
//       const uploadedFile = await uploadFileToDrive(file, folderName);
      
//       return {
//         name: file.originalname,
//         url: uploadedFile.viewUrl,      // URL to view the file in Google Drive
//         downloadUrl: uploadedFile.downloadUrl, // URL to download the file
//         type: file.mimetype
//       };
//     });
    
//     // Wait for all uploads to complete
//     const deliverables = await Promise.all(uploadPromises);
    
//     // Handle revision submission if revisionId is provided
//     if (revisionId) {
//       console.log(`Processing revision submission for revisionId: ${revisionId}`);
      
//       // Check if job is in revision_requested status
//       if (job.status !== 'revision_requested' && job.status !== 'revision_in_progress') {
//         return res.status(400).json({
//           success: false,
//           message: 'Can only submit revisions for jobs that have a revision requested'
//         });
//       }
      
//       // Find the revision
//       const revisionIndex = job.revisions.findIndex(
//         rev => rev._id.toString() === revisionId
//       );
      
//       if (revisionIndex === -1) {
//         return res.status(404).json({
//           success: false,
//           message: 'Revision request not found'
//         });
//       }
      
//       console.log(`Found revision at index ${revisionIndex}`);
      
//       // Update the revision
//       job.revisions[revisionIndex].status = 'completed';
//       job.revisions[revisionIndex].completedAt = new Date();
//       job.revisions[revisionIndex].freelancerNotes = req.body.message || '';
//       job.revisions[revisionIndex].deliverables = deliverables;
      
//       // Update job status
//       job.status = 'revision_completed';
      
//       await job.save();
      
//       return res.status(200).json({
//         success: true,
//         data: job,
//         message: 'Revision submitted successfully. The client will be notified to review the changes.'
//       });
//     }
//     // Handle initial submission
//     else {
//       // Check if job is in progress
//       if (job.status !== 'in_progress') {
//         return res.status(400).json({
//           success: false,
//           message: 'Can only submit work for jobs that are in progress'
//         });
//       }
      
//       // Update deliverables with Google Drive URLs
//       job.deliverables = deliverables;
      
//       // Update job status to completed
//       job.status = 'completed';
//       job.freelancerNote = req.body.message || '';
      
//       await job.save();
      
//       return res.status(200).json({
//         success: true,
//         data: job,
//         message: 'Work submitted successfully. The client has been notified and can review your work.'
//       });
//     }
//   } catch (error) {
//     console.error('Error in submitWork:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };


exports.submitWork = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { revisionId, message } = req.body;

    // Validate jobId
    if (!jobId || jobId === 'undefined') {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid job ID is required' 
      });
    }

    console.log(`Processing work submission for jobId: ${jobId}`);
    
    // Find the job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }

    // Check if user is the freelancer assigned to this job
    if (!job.freelancer || job.freelancer.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to submit work for this job' 
      });
    }

    // Process uploaded files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files uploaded' 
      });
    }

    console.log(`Processing ${req.files.length} files for upload`);

    // Upload files to Google Drive
    const uploadPromises = req.files.map(async (file) => {
      try {
        // Create a folder for this job
        const folderName = `Job_${job._id}_${job.title.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Upload to Google Drive
        const uploadedFile = await uploadFileToDrive(file, folderName);
        
        return {
          name: file.originalname,
          url: uploadedFile.viewUrl,      // URL to view the file in Google Drive
          downloadUrl: uploadedFile.downloadUrl, // URL to download the file
          type: file.mimetype,
          uploadedAt: new Date()
        };
      } catch (uploadError) {
        console.error(`Error uploading file ${file.originalname}:`, uploadError);
        throw new Error(`Failed to upload file: ${file.originalname}`);
      }
    });

    // Wait for all uploads to complete
    let deliverables;
    try {
      deliverables = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${deliverables.length} files`);
    } catch (uploadError) {
      console.error('Error uploading files:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload files to Google Drive',
        error: uploadError.message
      });
    }

    // Handle revision submission if revisionId is provided
    if (revisionId && revisionId !== 'undefined') {
      console.log(`Processing revision submission for revisionId: ${revisionId}`);
      
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

      console.log(`Found revision at index ${revisionIndex}`);

      // Update the revision
      job.revisions[revisionIndex].status = 'completed';
      job.revisions[revisionIndex].completedAt = new Date();
      job.revisions[revisionIndex].freelancerNotes = message || '';
      job.revisions[revisionIndex].deliverables = deliverables;

      // Update job status
      job.status = 'revision_completed';

      await job.save();

      console.log('Revision submitted successfully');

      return res.status(200).json({
        success: true,
        data: job,
        message: 'Revision submitted successfully. The client will be notified to review the changes.'
      });
    }
    // Handle initial submission
    else {
      console.log('Processing initial work submission');
      
      // Check if job is in progress
      if (job.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Can only submit work for jobs that are in progress'
        });
      }

      // Update deliverables with Google Drive URLs
      job.deliverables = deliverables;

      // Update job status to completed
      job.status = 'completed';
      job.freelancerNote = message || '';

      await job.save();

      console.log('Initial work submitted successfully');

      return res.status(200).json({
        success: true,
        data: job,
        message: 'Work submitted successfully. The client has been notified and can review your work.'
      });
    }
  } catch (error) {
    console.error('Error in submitWork:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'CastError' && error.path === '_id') {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID provided'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error occurred while processing your request',
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