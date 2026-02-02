import { Router } from 'express';
import {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  updateVendorStatus,
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

// Delete vendor
router.delete('/:id', deleteVendor);

export default router;
