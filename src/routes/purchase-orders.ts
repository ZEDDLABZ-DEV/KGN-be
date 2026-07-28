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
import { authorize } from '@/middleware/Permissions';
import { Router } from 'express';

const purchaseOrderRouter: any = Router();

// Create purchase order from material request (admin only)
purchaseOrderRouter.post('/', authorize(['create_purchase_orders']), createPurchaseOrder);

// Get all purchase orders
purchaseOrderRouter.get('/', getAllPurchaseOrders);

// Get purchase orders by material request — registered before /:id
purchaseOrderRouter.get('/material-request/:materialRequestId', getPurchaseOrdersByMaterialRequest);

// Get purchase order by ID
purchaseOrderRouter.get('/:id', getPurchaseOrderById);

// Update purchase order (admin only)
purchaseOrderRouter.put('/:id', authorize(['update_purchase_orders']), updatePurchaseOrder);

// Update purchase order status (admin only)
purchaseOrderRouter.patch('/:id/status', authorize(['update_purchase_orders']), updatePurchaseOrderStatus);

// Delete purchase order (admin only)
purchaseOrderRouter.delete('/:id', authorize(['delete_purchase_orders']), deletePurchaseOrder);

// Add item to purchase order (admin only)
purchaseOrderRouter.post('/:id/items', authorize(['update_purchase_orders']), addItemToPurchaseOrder);

// Update purchase order item (admin only)
purchaseOrderRouter.put('/items/:itemId', authorize(['update_purchase_orders']), updatePurchaseOrderItem);

// Delete purchase order item (admin only)
purchaseOrderRouter.delete('/items/:itemId', authorize(['update_purchase_orders']), deletePurchaseOrderItem);

export { purchaseOrderRouter };
