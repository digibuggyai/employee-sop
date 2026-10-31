-- CreateTable
CREATE TABLE "DailyTaskNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTaskNote_date_idx" ON "DailyTaskNote"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTaskNote_userId_date_key" ON "DailyTaskNote"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyTaskNote" ADD CONSTRAINT "DailyTaskNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
