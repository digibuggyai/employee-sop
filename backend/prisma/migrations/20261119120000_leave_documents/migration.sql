ALTER TABLE "Leave" ADD COLUMN     "attachmentId" TEXT;
CREATE TABLE "LeaveDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveDocument_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "LeaveDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaveDocument" ADD CONSTRAINT "LeaveDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
