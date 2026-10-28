-- Logins become a sheet: admin-defined columns + one row of cells per login.

-- CreateTable
CREATE TABLE "VaultColumn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultColumn_pkey" PRIMARY KEY ("id")
);

-- The old fixed fields become the first columns, so existing logins keep their data
INSERT INTO "VaultColumn" ("id", "name", "secret", "position") VALUES
    ('col_name', 'Name', false, 0),
    ('col_link', 'Link', false, 1),
    ('col_user', 'Username', false, 2),
    ('col_pass', 'Password', true, 3),
    ('col_notes', 'Notes', false, 4);

-- AlterTable: move each login's values into cells (the password stays encrypted as it was)
ALTER TABLE "VaultItem" ADD COLUMN     "cells" JSONB NOT NULL DEFAULT '{}';
UPDATE "VaultItem" SET "cells" = jsonb_strip_nulls(jsonb_build_object(
    'col_name', "title", 'col_link', "url", 'col_user', "username", 'col_pass', "passwordEnc", 'col_notes', "notes"));
ALTER TABLE "VaultItem" DROP COLUMN "notes",
DROP COLUMN "passwordEnc",
DROP COLUMN "url",
DROP COLUMN "username";
