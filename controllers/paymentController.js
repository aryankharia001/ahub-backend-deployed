// controllers/paymentController.js
const Job = require('../models/Job');
const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.processDepositPayment = async (req, res) => {
    try {
      const { jobId, paymentMethod, paymentDetails } = req.body;
      
      // Find the job
      const job = await Job.findById(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }
      
      // Verify user is the job owner
      if (job.client.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to make payment for this job'
        });
      }
      
      // Verify job is in approved status
      if (job.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Payment can only be made for approved jobs'
        });
      }
      
      // In a real app, you would process the payment with Stripe/PayPal/etc here
      // This is a simplified example - add your payment processing logic
  
      // Mock successful payment
      const paymentSuccessful = true;
      
      if (paymentSuccessful) {
        // Update job status and payment info
        job.status = 'deposit_paid';
        job.paymentStatus = 'deposit_paid';
        job.depositPaidAt = new Date();
        
        await job.save();
        
        return res.status(200).json({
          success: true,
          data: job,
          message: 'Deposit payment processed successfully. Contributors can now apply for this job.'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Payment processing failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error in processDepositPayment:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

// Process final payment (remaining 50%)
exports.processFinalPayment = async (req, res) => {
  try {
    const { jobId, paymentMethod, paymentDetails } = req.body;
    
    // Find the job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Verify user is the job owner
    if (job.client.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to make payment for this job'
      });
    }
    
    // Verify job is in appropriate status for final payment
    if (job.status !== 'completed' && job.status !== 'revision_completed' && job.status !== 'approved_by_client') {
      return res.status(400).json({
        success: false,
        message: 'Final payment can only be made for completed or approved jobs'
      });
    }
    
    // Calculate final payment (total price - deposit)
    const finalAmount = job.price - job.depositAmount;
    
    // In a real app, you would process the payment with Stripe/PayPal/etc here
    // This is a simplified example - add your payment processing logic
    
    // Mock successful payment
    const paymentSuccessful = true;
    
    if (paymentSuccessful) {
      // Update job status and payment info
      job.status = 'final_paid';
      job.paymentStatus = 'final_paid';
      job.finalPaidAt = new Date();
      
      await job.save();
      
      // Send notification to admin that final payment has been made
      // notificationService.sendToAdmin(...) - implement this separately
      
      return res.status(200).json({
        success: true,
        data: job,
        message: 'Final payment processed successfully. You can now download the full version of the deliverables.'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment processing failed. Please try again.'
      });
    }
  } catch (error) {
    console.error('Error in processFinalPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};