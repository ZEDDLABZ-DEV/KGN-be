-- StockMovement: `unit` is an informational snapshot (not authoritative) and
-- `referenceId` is only needed to reverse GRN-generated movements, so both are
-- optional. `createdById` tracks the user who triggered the movement.
ALTER TABLE "StockMovement" ALTER COLUMN "unit" DROP NOT NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "referenceId" DROP NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN "createdById" TEXT;
