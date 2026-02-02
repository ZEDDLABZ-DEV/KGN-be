import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrdersByMaterialRequest,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  addItemToPurchaseOrder,
  updatePurchaseOrderItem,
  deletePurchaseOrderItem,
} from '@/controllers/purchase-orders';
import { Router } from 'express';

const purchaseOrderRouter: any = Router();

// Create purchase order from material request
purchaseOrderRouter.post('/', createPurchaseOrder);

// Get all purchase orders
purchaseOrderRouter.get('/', getAllPurchaseOrders);

// Get purchase orders by material request
purchaseOrderRouter.get('/material-request/:materialRequestId', getPurchaseOrdersByMaterialRequest);

// Get purchase order by ID
purchaseOrderRouter.get('/:id', getPurchaseOrderById);

// Update purchase order
purchaseOrderRouter.put('/:id', updatePurchaseOrder);

// Update purchase order status
purchaseOrderRouter.patch('/:id/status', updatePurchaseOrderStatus);

// Delete purchase order
purchaseOrderRouter.delete('/:id', deletePurchaseOrder);

// Add item to purchase order
purchaseOrderRouter.post('/:id/items', addItemToPurchaseOrder);

// Update purchase order item
purchaseOrderRouter.put('/items/:itemId', updatePurchaseOrderItem);

// Delete purchase order item
purchaseOrderRouter.delete('/items/:itemId', deletePurchaseOrderItem);

export { purchaseOrderRouter };

