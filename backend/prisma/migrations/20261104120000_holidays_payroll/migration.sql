CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Gazetted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayBonus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

CREATE UNIQUE INDEX "PayBonus_userId_month_key" ON "PayBonus"("userId", "month");

ALTER TABLE "PayBonus" ADD CONSTRAINT "PayBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Holiday" ("id", "date", "name", "type") VALUES
    ('hol_20260101', '2026-01-01', 'New Year', 'Gazetted'),
    ('hol_20260126', '2026-01-26', 'Republic Day', 'Compulsory'),
    ('hol_20260303', '2026-03-03', 'Choti Holi', 'Gazetted'),
    ('hol_20260304', '2026-03-04', 'Holi', 'Gazetted'),
    ('hol_20260815', '2026-08-15', 'Independence Day', 'Compulsory'),
    ('hol_20260828', '2026-08-28', 'Rakhi', 'Gazetted'),
    ('hol_20261002', '2026-10-02', 'Gandhi Jayanti', 'Compulsory'),
    ('hol_20261020', '2026-10-20', 'Dussehra', 'Gazetted'),
    ('hol_20261107', '2026-11-07', 'Choti Diwali', 'Gazetted'),
    ('hol_20261108', '2026-11-08', 'Diwali', 'Gazetted'),
    ('hol_20261109', '2026-11-09', 'Diwali holiday', 'Gazetted'),
    ('hol_20261110', '2026-11-10', 'Govardhan', 'Gazetted'),
    ('hol_20261225', '2026-12-25', 'Christmas', 'Gazetted');
