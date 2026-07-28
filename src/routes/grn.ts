import { Router } from 'express';
import { authorize } from '@/middleware/Permissions';
import {
  createGRN,
  getAllGRNs,
  getGRNById,
  getGRNsByPurchaseOrder,
  getGRNsByProject,
  updateGRN,
  updateGRNStatus,
  deleteGRN,
  getGRNSummary,
} from '@/controllers/grn';

const router: any = Router();

// Create GRN from Purchase Order (admin or accountant)
router.post('/', authorize(['create_grn']), createGRN);

// Get all GRNs (with optional filters: status, purchaseOrderId, projectId)
router.get('/', getAllGRNs);

// NOTE: specific static sub-paths must be registered before the generic
// /:id route below, otherwise they get swallowed by the :id param matcher.

// Get GRNs by Purchase Order
router.get('/purchase-order/:purchaseOrderId', getGRNsByPurchaseOrder);

// Get GRNs by Project
router.get('/project/:projectId', getGRNsByProject);

// Get GRN summary for a purchase order
router.get('/summary/purchase-order/:purchaseOrderId', getGRNSummary);

// Get GRN by ID
router.get('/:id', getGRNById);

// Update GRN (admin or accountant)
router.put('/:id', authorize(['update_grn']), updateGRN);

// Update GRN status (admin or accountant)
router.patch('/:id/status', authorize(['update_grn']), updateGRNStatus);

// Delete GRN (admin or accountant)
router.delete('/:id', authorize(['delete_grn']), deleteGRN);

export default router;
