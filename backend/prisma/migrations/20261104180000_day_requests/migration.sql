CREATE TYPE "DayRequestKind" AS ENUM ('WFH', 'HALF_DAY', 'SHORT_LEAVE');

CREATE TABLE "DayRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "DayRequestKind" NOT NULL,
    "time" TEXT,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DayRequest_status_idx" ON "DayRequest"("status");

CREATE UNIQUE INDEX "DayRequest_userId_date_kind_key" ON "DayRequest"("userId", "date", "kind");

ALTER TABLE "DayRequest" ADD CONSTRAINT "DayRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DayRequest" ADD CONSTRAINT "DayRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

