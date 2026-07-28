-- Purchase Order: drop the DRAFT/PENDING pre-approval stage (POs are now created
-- directly as APPROVED). Existing DRAFT/PENDING rows are promoted to APPROVED.
BEGIN;

ALTER TYPE "PurchaseOrderStatus" RENAME TO "PurchaseOrderStatus_old";
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" TYPE "PurchaseOrderStatus" USING (
  CASE
    WHEN "status"::text IN ('DRAFT', 'PENDING') THEN 'APPROVED'
    ELSE "status"::text
  END
)::"PurchaseOrderStatus";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

DROP TYPE "PurchaseOrderStatus_old";

COMMIT;

-- Vendor approval workflow: PO creation with a vendorId requires the vendor to
-- be ACTIVE *and* APPROVED.
CREATE TYPE "VendorApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Vendor" ADD COLUMN "approvalStatus" "VendorApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- Vendors created before this workflow existed are grandfathered in as approved
-- so existing purchase-order flows keep working.
UPDATE "Vendor" SET "approvalStatus" = 'APPROVED';

-- Replace the mutable Inventory/InventoryTransaction counter with an
-- append-only, project-scoped StockMovement ledger.
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT IF EXISTS "InventoryTransaction_inventoryId_fkey";
ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS "Inventory_projectId_fkey";

DROP TABLE IF EXISTS "InventoryTransaction";
DROP TABLE IF EXISTS "Inventory";
DROP TYPE IF EXISTS "InventoryTransactionType";

CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryItem_name_key" ON "InventoryItem"("name");

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_projectId_inventoryItemId_idx" ON "StockMovement"("projectId", "inventoryItemId");

CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Units catalogue: admin-managed dropdown suggestions for free-text unit fields.
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

INSERT INTO "Unit" ("id", "name", "status", "createdAt", "updatedAt")
VALUES
    ('unit_bags', 'Bags', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_tons', 'Tons', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_kg', 'Kg', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_pieces', 'Pieces', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_liters', 'Liters', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_meters', 'Meters', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_sqft', 'Sq. Ft', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_cuft', 'Cu. Ft', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_rolls', 'Rolls', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_boxes', 'Boxes', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Roles used by the new gating matrix (admin already exists and is granted
-- every permission by prisma/seed.ts).
INSERT INTO "Role" ("id", "name", "createdAt", "updatedAt")
VALUES
    ('role_accountant', 'accountant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('role_supervisor', 'supervisor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Permissions for Purchase Orders (admin-only), GRN (admin or accountant),
-- Inventory (reads: admin/accountant/supervisor, issue: admin/supervisor) and
-- Units (admin-only mutations). Role <-> permission wiring for non-admin
-- roles happens in prisma/seed.ts.
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
    ('perm_create_purchase_orders', 'create_purchase_orders', 'Create purchase orders from an approved material request', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_update_purchase_orders', 'update_purchase_orders', 'Update purchase orders, their items, and status', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_delete_purchase_orders', 'delete_purchase_orders', 'Delete purchase orders that have not been sent yet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_create_grn', 'create_grn', 'Create goods receipt notes against a purchase order', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_update_grn', 'update_grn', 'Update goods receipt notes and their status', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_delete_grn', 'delete_grn', 'Delete goods receipt notes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_view_inventory', 'view_inventory', 'View inventory stock levels and movement ledger', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_issue_inventory', 'issue_inventory', 'Issue (stock out) materials against a project', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_create_units', 'create_units', 'Create catalogue units', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_update_units', 'update_units', 'Rename or change status of catalogue units', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_delete_units', 'delete_units', 'Delete catalogue units', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_manage_vendors', 'manage_vendors', 'Approve/reject vendors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
