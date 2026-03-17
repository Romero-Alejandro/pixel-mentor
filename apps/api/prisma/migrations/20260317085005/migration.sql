/*
  Warnings:

  - The values [idle,active,paused_for_question,awaiting_confirmation,paused_idle,completed,escalated] on the enum `SessionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `keyHash` on the `api_keys` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `turnNumber` on the `interactions` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to alter the column `parentEmail` on the `parental_consents` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `ipAddress` on the `parental_consents` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(45)`.
  - You are about to drop the column `createdAt` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `lessonId` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `sessions` table. All the data in the column will be lost.
  - You are about to alter the column `currentInteractionId` on the `sessions` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(36)`.
  - You are about to drop the column `lessonId` on the `teacher_review_tickets` table. All the data in the column will be lost.
  - You are about to drop the `Leccion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pregunta` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lesson_chunks` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `recipeId` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AtomType" AS ENUM ('MICROLECTURE', 'DEMO', 'MINI_ACTIVITY', 'HINT', 'MINI_QUIZ', 'REMEDIAL', 'INTERACTIVE', 'MANIPULATIVE', 'DRAGDROP', 'MCQ');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('START_LESSON', 'COMPONENT_PLAY', 'ACTIVITY_ATTEMPT', 'HINT_USED', 'LESSON_COMPLETE', 'REMEDIATION_TRIGGERED', 'TTS_PLAY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'MASTERED', 'NEEDS_REMEDIATION', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "SessionStatus_new" AS ENUM ('IDLE', 'ACTIVE', 'PAUSED_FOR_QUESTION', 'AWAITING_CONFIRMATION', 'PAUSED_IDLE', 'COMPLETED', 'ESCALATED');
ALTER TABLE "public"."sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sessions" ALTER COLUMN "status" TYPE "SessionStatus_new" USING ("status"::text::"SessionStatus_new");
ALTER TYPE "SessionStatus" RENAME TO "SessionStatus_old";
ALTER TYPE "SessionStatus_new" RENAME TO "SessionStatus";
DROP TYPE "public"."SessionStatus_old";
ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'IDLE';
COMMIT;

-- DropForeignKey
ALTER TABLE "Pregunta" DROP CONSTRAINT "Pregunta_leccionId_fkey";

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_userId_fkey";

-- DropForeignKey
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_chunks" DROP CONSTRAINT "lesson_chunks_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_studentId_fkey";

-- DropIndex
DROP INDEX "api_keys_userId_idx";

-- DropIndex
DROP INDEX "sessions_lessonId_idx";

-- DropIndex
DROP INDEX "sessions_status_idx";

-- DropIndex
DROP INDEX "sessions_studentId_idx";

-- DropIndex
DROP INDEX "teacher_review_tickets_status_idx";

-- DropIndex
DROP INDEX "teacher_review_tickets_studentId_idx";

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "keyHash" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "interactions" ALTER COLUMN "turnNumber" SET DATA TYPE SMALLINT;

-- AlterTable
ALTER TABLE "parental_consents" ALTER COLUMN "parentEmail" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "ipAddress" SET DATA TYPE VARCHAR(45);

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "createdAt",
DROP COLUMN "lessonId",
DROP COLUMN "updatedAt",
ADD COLUMN     "failedAttempts" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "outOfScope" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipeId" TEXT NOT NULL,
ADD COLUMN     "safetyFlag" VARCHAR(100),
ALTER COLUMN "status" SET DEFAULT 'IDLE',
ALTER COLUMN "currentInteractionId" SET DATA TYPE VARCHAR(36);

-- AlterTable
ALTER TABLE "teacher_review_tickets" DROP COLUMN "lessonId";

-- DropTable
DROP TABLE "Leccion";

-- DropTable
DROP TABLE "Pregunta";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "lesson_chunks";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "age" SMALLINT,
    "quota" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "minAge" SMALLINT,
    "maxAge" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "levelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "canonicalId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "expectedDurationMinutes" SMALLINT,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "moduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "atomId" TEXT NOT NULL,
    "order" SMALLINT NOT NULL,
    "condition" JSONB,
    "onCondition" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conceptId" TEXT,
    "activityId" TEXT,
    "script" JSONB,
    "stepType" TEXT DEFAULT 'content',

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "order" SMALLINT NOT NULL,
    "introduction" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "examples" JSONB NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "closure" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "order" SMALLINT NOT NULL,
    "instruction" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" VARCHAR(500) NOT NULL,
    "feedback" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atoms" (
    "id" TEXT NOT NULL,
    "canonicalId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "AtomType" NOT NULL,
    "ssmlChunks" JSONB,
    "content" JSONB,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'es-AR',
    "durationSeconds" SMALLINT,
    "difficulty" SMALLINT NOT NULL DEFAULT 1,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atom_options" (
    "id" TEXT NOT NULL,
    "atomId" TEXT NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" SMALLINT NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atom_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "atomId" TEXT NOT NULL,
    "index" SMALLINT NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" JSONB,
    "tsvector" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "mime" VARCHAR(50),
    "size" INTEGER,
    "meta" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attachments" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "atomId" TEXT,
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atom_competencies" (
    "id" TEXT NOT NULL,
    "atomId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "atom_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_tags" (
    "recipeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT,
    "atomId" TEXT,
    "status" "ProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "score" DOUBLE PRECISION,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "atomId" TEXT NOT NULL,
    "atomOptionId" TEXT,
    "attemptNo" SMALLINT NOT NULL DEFAULT 1,
    "response" JSONB,
    "correct" BOOLEAN,
    "elapsedMs" INTEGER,
    "hintUsed" SMALLINT NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_masteries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_masteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" "EventType" NOT NULL,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "levels_slug_key" ON "levels"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "modules_slug_key" ON "modules"("slug");

-- CreateIndex
CREATE INDEX "modules_levelId_idx" ON "modules"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_canonicalId_key" ON "recipes"("canonicalId");

-- CreateIndex
CREATE INDEX "recipes_published_moduleId_idx" ON "recipes"("published", "moduleId");

-- CreateIndex
CREATE INDEX "recipe_steps_recipeId_idx" ON "recipe_steps"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_steps_conceptId_idx" ON "recipe_steps"("conceptId");

-- CreateIndex
CREATE INDEX "recipe_steps_activityId_idx" ON "recipe_steps"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipeId_order_key" ON "recipe_steps"("recipeId", "order");

-- CreateIndex
CREATE INDEX "concepts_recipeId_idx" ON "concepts"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_recipeId_order_key" ON "concepts"("recipeId", "order");

-- CreateIndex
CREATE INDEX "activities_conceptId_idx" ON "activities"("conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "activities_conceptId_order_key" ON "activities"("conceptId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "atoms_canonicalId_key" ON "atoms"("canonicalId");

-- CreateIndex
CREATE INDEX "atoms_published_locale_difficulty_idx" ON "atoms"("published", "locale", "difficulty");

-- CreateIndex
CREATE INDEX "atom_options_atomId_isCorrect_idx" ON "atom_options"("atomId", "isCorrect");

-- CreateIndex
CREATE INDEX "knowledge_chunks_atomId_index_idx" ON "knowledge_chunks"("atomId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "assets_key_key" ON "assets"("key");

-- CreateIndex
CREATE INDEX "asset_attachments_atomId_idx" ON "asset_attachments"("atomId");

-- CreateIndex
CREATE INDEX "asset_attachments_recipeId_idx" ON "asset_attachments"("recipeId");

-- CreateIndex
CREATE INDEX "asset_attachments_assetId_idx" ON "asset_attachments"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_code_key" ON "competencies"("code");

-- CreateIndex
CREATE INDEX "atom_competencies_competencyId_idx" ON "atom_competencies"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "atom_competencies_atomId_competencyId_key" ON "atom_competencies"("atomId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "recipe_tags_tagId_idx" ON "recipe_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_tags_recipeId_tagId_key" ON "recipe_tags"("recipeId", "tagId");

-- CreateIndex
CREATE INDEX "user_progress_userId_recipeId_atomId_idx" ON "user_progress"("userId", "recipeId", "atomId");

-- CreateIndex
CREATE INDEX "user_progress_userId_status_idx" ON "user_progress"("userId", "status");

-- CreateIndex
CREATE INDEX "activity_attempts_userId_atomId_createdAt_idx" ON "activity_attempts"("userId", "atomId", "createdAt");

-- CreateIndex
CREATE INDEX "competency_masteries_userId_mastery_idx" ON "competency_masteries"("userId", "mastery");

-- CreateIndex
CREATE UNIQUE INDEX "competency_masteries_userId_competencyId_key" ON "competency_masteries"("userId", "competencyId");

-- CreateIndex
CREATE INDEX "event_logs_userId_eventType_timestamp_idx" ON "event_logs"("userId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "event_logs_sessionId_idx" ON "event_logs"("sessionId");

-- CreateIndex
CREATE INDEX "api_keys_userId_isActive_idx" ON "api_keys"("userId", "isActive");

-- CreateIndex
CREATE INDEX "sessions_studentId_status_idx" ON "sessions"("studentId", "status");

-- CreateIndex
CREATE INDEX "sessions_recipeId_idx" ON "sessions"("recipeId");

-- CreateIndex
CREATE INDEX "teacher_review_tickets_studentId_status_idx" ON "teacher_review_tickets"("studentId", "status");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_consents" ADD CONSTRAINT "parental_consents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atom_options" ADD CONSTRAINT "atom_options_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_review_tickets" ADD CONSTRAINT "teacher_review_tickets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "asset_attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "asset_attachments_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "asset_attachments_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atom_competencies" ADD CONSTRAINT "atom_competencies_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atom_competencies" ADD CONSTRAINT "atom_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_atomId_fkey" FOREIGN KEY ("atomId") REFERENCES "atoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_atomOptionId_fkey" FOREIGN KEY ("atomOptionId") REFERENCES "atom_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_masteries" ADD CONSTRAINT "competency_masteries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_masteries" ADD CONSTRAINT "competency_masteries_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
