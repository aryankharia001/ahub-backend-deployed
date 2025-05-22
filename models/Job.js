// Updated models/Job.js with revision tracking
const mongoose = require('mongoose');

const deliverableSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  downloadUrl: {  // Add this field for direct download URL
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// New schema for revision tracking
const revisionSchema = new mongoose.Schema({
  requestedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  clientNotes: {
    type: String,
    default: ''
  },
  freelancerNotes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['requested', 'in_progress', 'completed', 'approved'],
    default: 'requested'
  },
  deliverables: [deliverableSchema]
});

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required'],
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Deadline must be in the future'
    }
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'deposit_paid', 'in_progress', 'completed', 'final_paid', 'review', 'revision_requested', 'revision_in_progress', 'revision_completed', 'approved_by_client', 'job_end'],
    default: 'pending' // Keep as pending so admin can review
  },
  paymentStatus: {
    type: String,
    enum: ['none', 'deposit_pending', 'deposit_paid', 'final_pending', 'final_paid'],
    default: 'none'
  },
  price: {
    type: Number,
    default: null
  },
  depositAmount: {
    type: Number,
    default: null
  },
  depositPaidAt: {
    type: Date,
    default: null
  },
  finalPaidAt: {
    type: Date,
    default: null
  },
  adminFeedback: {
    type: String,
    default: null
  },
  clientFeedback: {
    type: String,
    default: null
  },
  freelancerNote: {
    type: String,
    default: null
  },
  // Original deliverables
  deliverables: [deliverableSchema],
  // Track revision history
  revisions: [revisionSchema],
  // Number of remaining revisions available to client
  revisionsRemaining: {
    type: Number,
    default: 2
  },
  // Track if client has approved the final work
  clientApproved: {
    type: Boolean,
    default: false
  },
  skills: [{
    type: String,
    trim: true
  }],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  category: {
    type: String,
    required: [true, 'Category is required']
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'invite_only'],
    default: 'public'
  },
  completedAt: {
    type: Date,
    default: null
  },
  clientApprovedAt: {
    type: Date,
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  
}, {
  timestamps: true
});

// Pre-save hook to calculate deposit when price is set
jobSchema.pre('save', function(next) {
  if (this.price && !this.depositAmount) {
    this.depositAmount = Math.round((this.price / 2) * 100) / 100; // 50% deposit, rounded to 2 decimal places
  }
  
  // Set completedAt date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Set clientApprovedAt date when clientApproved changes to true
  if (this.isModified('clientApproved') && this.clientApproved && !this.clientApprovedAt) {
    this.clientApprovedAt = new Date();
  }
  
  // Set assignedAt date when a freelancer is assigned
  if (this.isModified('freelancer') && this.freelancer && !this.assignedAt) {
    this.assignedAt = new Date();
  }
  
  next();
});

// Indexes
jobSchema.index({ status: 1 });
jobSchema.index({ client: 1 });
jobSchema.index({ freelancer: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ deadline: 1 });
jobSchema.index({ paymentStatus: 1 });

const Job = mongoose.model('Job', jobSchema);
module.exports = Job;