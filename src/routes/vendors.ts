import { Router } from 'express';
import { authorize } from '@/middleware/Permissions';
import {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  updateVendorStatus,
  updateVendorApprovalStatus,
  deleteVendor,
  getVendorStats,
  getActiveVendors,
} from '@/controllers/vendors';

const router: any = Router();

// Get active vendors (for dropdowns)
router.get('/active', getActiveVendors);

// Create vendor
router.post('/', createVendor);

// Get all vendors (with optional filters: status, search)
router.get('/', getAllVendors);

// Get vendor by ID
router.get('/:id', getVendorById);

// Get vendor statistics
router.get('/:id/stats', getVendorStats);

// Update vendor
router.put('/:id', updateVendor);

// Update vendor status
router.patch('/:id/status', updateVendorStatus);

// Update vendor approval status (admin only)
router.patch('/:id/approval-status', authorize(['manage_vendors']), updateVendorApprovalStatus);

// Delete vendor
router.delete('/:id', deleteVendor);

export default router;
