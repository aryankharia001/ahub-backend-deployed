// Updated jobRoutes.js file with new revision-related routes
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const jobController = require('../controllers/jobController');
const contributorController = require('../controllers/contributorController');
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/adminMiddleware');
const contributorMiddleware = require('../middleware/contributorMiddleware');
const paymentController = require('../controllers/paymentController');
const { upload, handleUploadError } = require('../middleware/fileUpload');

// Validation middleware
const validateJobInput = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 20 })
    .withMessage('Description must be at least 20 characters'),
  body('deadline')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
];

// Create a job (client only)
router.post(
  '/',
  authMiddleware,
  validateJobInput,
  jobController.createJob
);

// Get all jobs (with filters)
router.get('/', jobController.getAllJobs);

// Get single job
router.get('/:id', jobController.getJobById);

// Update job (client only, for their own jobs)
router.put(
  '/:id',
  authMiddleware,
  validateJobInput,
  jobController.updateJob
);

// Delete job (client only, for their own jobs)
router.delete(
  '/:id',
  authMiddleware,
  jobController.deleteJob
);

// Admin route to approve/reject job with price
router.put(
  '/:id/review',
  authMiddleware,
  adminMiddleware,
  body('status').isIn(['approved', 'rejected']),
  body('price').optional().isNumeric(),
  body('adminFeedback').optional().isString(),
  jobController.reviewJob
);

// Admin route to get all jobs with filtering and sorting
router.get(
  '/admin/jobs',
  [authMiddleware, adminMiddleware],
  jobController.getAdminJobs
);

// Client route to accept price and move job to in_progress
router.put(
  '/:id/accept',
  authMiddleware,
  jobController.acceptJobOffer
);

// Get client's own jobs
router.get(
  '/my/jobs',
  authMiddleware,
  jobController.getMyJobs
);

// Admin route to get all pending jobs
router.get(
  '/admin/pending',
  [authMiddleware, adminMiddleware],
  jobController.getPendingJobs
);

// Mark job as completed (admin only)
router.put(
  '/:id/complete',
  [authMiddleware, adminMiddleware],
  jobController.markJobAsCompleted
);

// Admin route to deliver job with watermarked files
router.put(
  '/:id/deliver',
  [authMiddleware, adminMiddleware],
  upload.array('files', 10), // Allow up to 10 files
  handleUploadError,
  jobController.deliverJob
);

// Admin route to deliver final unwatermarked files
router.put(
  '/:id/deliver-final',
  [authMiddleware, adminMiddleware],
  upload.array('files', 10), // Allow up to 10 files
  handleUploadError,
  jobController.deliverFinalFiles
);

// Payment routes
// Process deposit payment (50%)
router.post(
  '/payment/deposit',
  authMiddleware,
  [
    body('jobId').notEmpty().withMessage('Job ID is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required')
  ],
  paymentController.processDepositPayment
);

// Process final payment (remaining 50%)
router.post(
  '/payment/final',
  authMiddleware,
  [
    body('jobId').notEmpty().withMessage('Job ID is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required')
  ],
  paymentController.processFinalPayment
);

// CONTRIBUTOR ROUTES
// Get available jobs for contributors
router.get(
  '/contributor/available',
  authMiddleware,
  contributorController.getAvailableJobs
);

// Get contributor's assigned jobs
router.get(
  '/contributor/my-jobs',
  authMiddleware,
  contributorController.getMyJobs
);

// Apply for a job
router.post(
  '/:id/apply',
  authMiddleware,
  contributorController.applyForJob
);

// Submit work for a job (initial submission or revision)
router.post(
  '/:id/submit-work',
  authMiddleware,
  upload.array('files', 10), // Allow up to 10 files
  handleUploadError,
  contributorController.submitWork
);

// Get contributor dashboard statistics
router.get(
  '/contributor/stats',
  authMiddleware,
  contributorController.getContributorStats
);

// CLIENT ROUTES
// Get client's statistics
router.get(
  '/client/stats',
  authMiddleware,
  clientController.getClientStats
);

// NEW ROUTES FOR REVISION SYSTEM

// Client reviews submitted work (approving or requesting revision)
router.post(
  '/:id/client-review',
  authMiddleware,
  [
    body('action').isIn(['approve', 'request_revision']).withMessage('Action must be either "approve" or "request_revision"'),
    body('feedback').optional().isString()
  ],
  clientController.reviewSubmittedWork
);

// Contributor gets revision requests for a job
router.get(
  '/:jobId/revisions',
  authMiddleware,
  contributorController.getRevisionRequests
);

// Contributor starts working on a revision
router.post(
  '/:jobId/revisions/:revisionId/start',
  authMiddleware,
  contributorController.startRevision
);

// Get client jobs
router.get(
  '/client/jobs',
  authMiddleware,
  clientController.getClientJobs
);





// Essential API routes for the revision system

// Add these routes to jobRoutes.js
// CLIENT ROUTES
// Client reviews submitted work (approving or requesting revision)
router.post(
  '/:id/client-review',
  authMiddleware,
  [
    body('action').isIn(['approve', 'request_revision']).withMessage('Action must be either "approve" or "request_revision"'),
    body('feedback').optional().isString()
  ],
  clientController.reviewSubmittedWork
);

// CONTRIBUTOR ROUTES
// Contributor gets revision requests for a job
router.get(
  '/:jobId/revisions',
  authMiddleware,
  contributorController.getRevisionRequests
);

// Contributor starts working on a revision
router.post(
  '/:jobId/revisions/:revisionId/start',
  authMiddleware,
  contributorController.startRevision
);

// Submit work for a job (initial submission or revision)
// Updated route to handle revisions - this replaces the original submit-work route
router.post(
  '/:id/submit-work',
  authMiddleware,
  upload.array('files', 10), // Allow up to 10 files
  handleUploadError,
  contributorController.submitWork
);


router.put(
  '/:id/no-revision-required',
  authMiddleware,
  jobController.noRevisionRequired
)


router.put(
  '/:id/revision-required',
  authMiddleware,
  jobController.revisionRequired
)


module.exports = router;