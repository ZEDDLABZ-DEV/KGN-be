import { Router } from 'express';
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

// Create GRN from Purchase Order
router.post('/', createGRN);

// Get all GRNs (with optional filters: status, purchaseOrderId, projectId)
router.get('/', getAllGRNs);

// Get GRN by ID
router.get('/:id', getGRNById);

// Get GRNs by Purchase Order
router.get('/purchase-order/:purchaseOrderId', getGRNsByPurchaseOrder);

// Get GRNs by Project
router.get('/project/:projectId', getGRNsByProject);

// Get GRN summary for a purchase order
router.get('/summary/purchase-order/:purchaseOrderId', getGRNSummary);

// Update GRN
router.put('/:id', updateGRN);

// Update GRN status
router.patch('/:id/status', updateGRNStatus);

// Delete GRN
router.delete('/:id', deleteGRN);

export default router;
