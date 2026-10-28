-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "halfDay" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AttendanceCorrection" ADD COLUMN     "halfDay" BOOLEAN;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leftOn" DATE;
