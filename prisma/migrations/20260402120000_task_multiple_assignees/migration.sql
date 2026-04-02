-- Many-to-many Tasks <-> labours (@relation "TaskLabourAssignment": A = Tasks.id, B = labours.id)

CREATE TABLE "_TaskLabourAssignment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskLabourAssignment_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_TaskLabourAssignment_B_index" ON "_TaskLabourAssignment"("B");

ALTER TABLE "_TaskLabourAssignment" ADD CONSTRAINT "_TaskLabourAssignment_A_fkey" FOREIGN KEY ("A") REFERENCES "Tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TaskLabourAssignment" ADD CONSTRAINT "_TaskLabourAssignment_B_fkey" FOREIGN KEY ("B") REFERENCES "labours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "_TaskLabourAssignment" ("A", "B")
SELECT "id", "assignedToId" FROM "Tasks" WHERE "assignedToId" IS NOT NULL;

ALTER TABLE "Tasks" DROP CONSTRAINT "Tasks_assignedToId_fkey";
ALTER TABLE "Tasks" DROP COLUMN "assignedToId";
