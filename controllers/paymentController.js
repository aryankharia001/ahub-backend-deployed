// controllers/paymentController.js
const Job = require('../models/Job');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay with your API keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create a Razorpay order for deposit payment
exports.createDepositOrder = async (req, res) => {
  try {
    const { jobId } = req.body;
    
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
    
    // Calculate deposit amount (50% of total price) - converting to paise for Razorpay
    const depositAmount = Math.round(job.price * 50 * 100); // Amount in paise (50% of total)
    
    // Create Razorpay order
    const options = {
      amount: depositAmount,
      currency: 'INR',
      receipt: `deposit_${job._id}`,
      notes: {
        jobId: job._id.toString(),
        paymentType: 'deposit',
        clientId: req.user.id
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    // Save the order ID to the job for verification later
    job.razorpayDepositOrderId = order.id;
    await job.save();
    
    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        jobId: job._id
      }
    });
  } catch (error) {
    console.error('Error in createDepositOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a Razorpay order for final payment
exports.createFinalOrder = async (req, res) => {
  try {
    const { jobId } = req.body;
    
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
    
    // Calculate final payment (remaining 50% of total price) - converting to paise for Razorpay
    const finalAmount = Math.round(job.price * 50 * 100); // Amount in paise (50% of total)
    
    // Create Razorpay order
    const options = {
      amount: finalAmount,
      currency: 'INR',
      receipt: `final_${job._id}`,
      notes: {
        jobId: job._id.toString(),
        paymentType: 'final',
        clientId: req.user.id
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    // Save the order ID to the job for verification later
    job.razorpayFinalOrderId = order.id;
    await job.save();
    
    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        jobId: job._id
      }
    });
  } catch (error) {
    console.error('Error in createFinalOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify Razorpay payment and update job status
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentType } = req.body;
    
    // Verify the payment signature
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    const isAuthentic = expectedSignature === razorpay_signature;
    
    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
    
    // Find the job associated with this order
    let job;
    if (paymentType === 'deposit') {
      job = await Job.findOne({ razorpayDepositOrderId: razorpay_order_id });
    } else if (paymentType === 'final') {
      job = await Job.findOne({ razorpayFinalOrderId: razorpay_order_id });
    }
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found for the given order'
      });
    }
    
    // Update job status based on payment type
    if (paymentType === 'deposit') {
      job.status = 'deposit_paid';
      job.paymentStatus = 'deposit_paid';
      job.depositPaidAt = new Date();
      job.razorpayDepositPaymentId = razorpay_payment_id;
      
      // Your job model already has depositAmount calculated in pre-save hook
      // We don't need to set it manually here since it's calculated based on the price
      
    } else if (paymentType === 'final') {
      job.status = 'final_paid';
      job.paymentStatus = 'final_paid';
      job.finalPaidAt = new Date();
      job.razorpayFinalPaymentId = razorpay_payment_id;
    }
    
    await job.save();
    
    return res.status(200).json({
      success: true,
      data: job,
      message: paymentType === 'deposit' 
        ? 'Deposit payment verified successfully. Contributors can now apply for this job.'
        : 'Final payment verified successfully. You can now download the full version of the deliverables.'
    });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Legacy methods maintained for backward compatibility
exports.processDepositPayment = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'This endpoint is deprecated. Please use the new Razorpay payment flow.'
  });
};

exports.processFinalPayment = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'This endpoint is deprecated. Please use the new Razorpay payment flow.'
  });
};