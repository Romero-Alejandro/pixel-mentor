-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AlterTable
ALTER TABLE "class_version_lessons" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
