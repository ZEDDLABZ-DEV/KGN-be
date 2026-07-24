-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "labourId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "description" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_projectId_date_idx" ON "Attendance"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_projectId_labourId_date_key" ON "Attendance"("projectId", "labourId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "labours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed attendance permissions
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
    ('perm_mark_attendance', 'mark_attendance', 'Mark or update worker attendance for a project', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_view_attendance', 'view_attendance', 'View worker attendance by date or date range', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
