import { Router } from 'express';
import {
  getAllInventory,
  getInventoryById,
  getInventoryByProject,
  createInventoryItem,
  updateInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
  getInventoryTransactions,
  getLowStockItems,
  getInventorySummary,
} from '@/controllers/inventory';

const router = Router();

// Get all inventory items with filters
router.get('/', getAllInventory as any);

// Get inventory summary/statistics
router.get('/summary', getInventorySummary as any);

// Get low stock items
router.get('/low-stock', getLowStockItems as any);

// Get inventory by project
router.get('/project/:projectId', getInventoryByProject as any);

// Get single inventory item by ID
router.get('/:id', getInventoryById as any);

// Get inventory transactions for an item
router.get('/:id/transactions', getInventoryTransactions as any);

// Create new inventory item (manual)
router.post('/', createInventoryItem as any);

// Update inventory item details (not quantity)
router.put('/:id', updateInventoryItem as any);

// Adjust inventory quantity (add/subtract/adjust)
router.post('/:id/adjust', adjustInventoryQuantity as any);

// Delete inventory item
router.delete('/:id', deleteInventoryItem as any);

export default router;
