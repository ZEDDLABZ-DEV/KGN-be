## Table `_prisma_migrations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `varchar` | Primary |
| `checksum` | `varchar` |  |
| `finished_at` | `timestamptz` |  Nullable |
| `migration_name` | `varchar` |  |
| `logs` | `text` |  Nullable |
| `rolled_back_at` | `timestamptz` |  Nullable |
| `started_at` | `timestamptz` |  |
| `applied_steps_count` | `int4` |  |

## Table `User`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `email` | `text` |  |
| `name` | `text` |  |
| `phone` | `text` |  |
| `gender` | `text` |  |
| `dateOfBirth` | `text` |  Nullable |
| `status` | `Status` |  |
| `createdAt` | `timestamp` |  |
| `roleId` | `text` |  Nullable |

## Table `Auth`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `userId` | `text` |  |
| `login` | `text` |  |
| `password` | `text` |  |
| `token` | `text` |  Nullable |
| `loginWith` | `LoginMethod` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `labours`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `phone` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `skills` | `_text` |  Nullable |
| `experience` | `text` |  Nullable |
| `status` | `Status` |  |
| `addedbyId` | `text` |  |
| `createdAt` | `timestamp` |  |

## Table `Projects`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `createdById` | `text` |  |
| `name` | `text` |  |
| `budget` | `text` |  |
| `location` | `text` |  |
| `projectId` | `text` |  |
| `teamId` | `text` |  Nullable |
| `description` | `text` |  |
| `startDate` | `timestamp` |  |
| `endDate` | `timestamp` |  |
| `status` | `ProjectStatus` |  |
| `managerId` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `Teams`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  |
| `leadId` | `text` |  |
| `status` | `Status` |  |
| `createdById` | `text` |  |
| `createdAt` | `timestamp` |  |

## Table `TeamPeoples`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `teamId` | `text` |  |
| `labourId` | `text` |  |

## Table `Tasks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  |
| `dueDate` | `timestamp` |  |
| `priority` | `Preiority` |  |
| `taskProgress` | `int4` |  |
| `status` | `TaskStatus` |  |
| `projectId` | `text` |  |
| `attachments` | `_text` |  Nullable |
| `createdById` | `text` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |
| `updates` | `_text` |  Nullable |

## Table `SubTasks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `taskId` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `status` | `TaskStatus` |  |
| `progress` | `int4` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `Role`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `Permission`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `RolePermission`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `roleId` | `text` |  |
| `permissionId` | `text` |  |

## Table `MaterialRequest`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `projectId` | `text` |  |
| `requestedBy` | `text` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `status` | `MaterialReqStatus` |  |
| `priority` | `Preiority` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `MaterialRequestItem`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `materialRequestId` | `text` |  |
| `itemName` | `text` |  |
| `quantity` | `float8` |  |
| `unit` | `text` |  |
| `estimatedCost` | `float8` |  Nullable |
| `remarks` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `BOQ`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `projectId` | `text` |  |
| `fileName` | `text` |  |
| `fileUrl` | `text` |  |
| `uploadedById` | `text` |  Nullable |
| `status` | `BOQStatus` |  |
| `tasksGenerated` | `int4` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `ProjectFiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `projectId` | `text` |  |
| `fileName` | `text` |  |
| `fileUrl` | `text` |  |
| `fileSize` | `int4` |  |
| `mimeType` | `text` |  |
| `uploadedById` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `Vendor`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `contactPerson` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `address` | `text` |  Nullable |
| `city` | `text` |  Nullable |
| `state` | `text` |  Nullable |
| `country` | `text` |  Nullable |
| `zipCode` | `text` |  Nullable |
| `gstNumber` | `text` |  Nullable |
| `panNumber` | `text` |  Nullable |
| `status` | `VendorStatus` |  |
| `rating` | `float8` |  Nullable |
| `notes` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |
| `approvalStatus` | `VendorApprovalStatus` |  |

## Table `PurchaseOrder`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `poNumber` | `text` |  |
| `materialRequestId` | `text` |  |
| `vendorId` | `text` |  Nullable |
| `vendorName` | `text` |  Nullable |
| `vendorContact` | `text` |  Nullable |
| `vendorEmail` | `text` |  Nullable |
| `vendorAddress` | `text` |  Nullable |
| `status` | `PurchaseOrderStatus` |  |
| `totalAmount` | `float8` |  |
| `notes` | `text` |  Nullable |
| `expectedDelivery` | `timestamp` |  Nullable |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `PurchaseOrderItem`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `purchaseOrderId` | `text` |  |
| `itemName` | `text` |  |
| `description` | `text` |  Nullable |
| `quantity` | `float8` |  |
| `unit` | `text` |  |
| `unitPrice` | `float8` |  |
| `totalPrice` | `float8` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `GRN`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `grnNumber` | `text` |  |
| `purchaseOrderId` | `text` |  |
| `receivedDate` | `timestamp` |  |
| `receivedBy` | `text` |  |
| `status` | `GRNStatus` |  |
| `remarks` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `GRNItem`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `grnId` | `text` |  |
| `purchaseOrderItemId` | `text` |  |
| `orderedQuantity` | `float8` |  |
| `receivedQuantity` | `float8` |  |
| `damagedQuantity` | `float8` |  |
| `pendingQuantity` | `float8` |  |
| `remarks` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `_TaskLabourAssignment`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `A` | `text` | Primary |
| `B` | `text` | Primary |

## Table `TaskUpdate`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `taskId` | `text` |  |
| `reportDate` | `timestamp` |  |
| `progressUpdate` | `text` |  |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |
| `images` | `_text` |  Nullable |

## Table `Attendance`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `projectId` | `text` |  |
| `labourId` | `text` |  |
| `date` | `date` |  |
| `status` | `AttendanceStatus` |  |
| `description` | `text` |  Nullable |
| `markedById` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `InventoryItem`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `unit` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `StockMovement`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `projectId` | `text` |  |
| `inventoryItemId` | `text` |  |
| `type` | `MovementType` |  |
| `quantity` | `float8` |  |
| `referenceType` | `text` |  |
| `referenceId` | `text` |  Nullable |
| `unit` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `createdById` | `text` |  Nullable |

## Table `Unit`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `status` | `Status` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Custom Types / Enums

### `LoginMethod`

`EMAIL` | `PHONE`

### `Preiority`

`LOW` | `MEDIUM` | `HIGH`

### `TaskStatus`

`NOTSTARTED` | `INPROGRESS` | `COMPLETED` | `ACTIONREQUIRED` | `ONHOLD`

### `Status`

`ACTIVE` | `INACTIVE` | `BLOCKED` | `BUSY` | `ACTIONREQUIRED`

### `ProjectStatus`

`NOTSTARTED` | `INPROGRESS` | `PAUSED` | `COMPLETED` | `ACTIONREQUIRED` | `ONHOLD` | `CANCELLED`

### `MaterialReqStatus`

`PENDING` | `APPROVED` | `REJECTED` | `ORDERED` | `DELIVERED` | `CANCELLED`

### `BOQStatus`

`PENDING` | `PROCESSING` | `PROCESSED` | `FAILED`

### `GRNStatus`

`PENDING` | `COMPLETED` | `PARTIALLY_RECEIVED` | `REJECTED`

### `VendorStatus`

`ACTIVE` | `INACTIVE` | `BLOCKED`

### `AttendanceStatus`

`PRESENT` | `ABSENT`

### `PurchaseOrderStatus`

`APPROVED` | `SENT` | `PARTIALLY_RECEIVED` | `RECEIVED` | `CANCELLED`

### `VendorApprovalStatus`

`PENDING` | `APPROVED` | `REJECTED`

### `MovementType`

`IN` | `OUT`

