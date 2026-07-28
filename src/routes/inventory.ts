import { Router } from 'express';
import { authorize } from '@/middleware/Permissions';
import {
  getAllInventoryItems,
  getProjectStock,
  getMaterialStock,
  getMovements,
  issueStock,
} from '@/controllers/inventory';

const router: any = Router();

// List all inventory items (admin, accountant, supervisor)
router.get('/items', authorize(['view_inventory']), getAllInventoryItems);

// Current stock per item for a project, derived from the ledger
router.get('/stock/project/:projectId', authorize(['view_inventory']), getProjectStock);

// Current stock for one item, broken down by project
router.get('/stock/material/:inventoryItemId', authorize(['view_inventory']), getMaterialStock);

// Stock movement ledger (filterable by projectId, inventoryItemId, type)
router.get('/movements', authorize(['view_inventory']), getMovements);

// Issue (stock out) materials against a project (admin, supervisor)
router.post('/issue', authorize(['issue_inventory']), issueStock);

export default router;
