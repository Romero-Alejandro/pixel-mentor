-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "daily_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tutorId" TEXT NOT NULL,

    CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tutorId" TEXT NOT NULL,
    "class_template_id" TEXT,
    "current_version_id" TEXT,
    "status" "ClassStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_lessons" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "recipeId" TEXT,
    "order" SMALLINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "duration" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_versions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '0.0.1',
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "slug" VARCHAR(255) NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'PUBLISHED',

    CONSTRAINT "class_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_version_lessons" (
    "id" TEXT NOT NULL,
    "class_version_id" TEXT NOT NULL,
    "recipeId" TEXT,
    "order" SMALLINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "duration" SMALLINT,
    "recipeSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_version_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_activities_userId_date_idx" ON "daily_activities"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activities_userId_date_key" ON "daily_activities"("userId", "date");

-- CreateIndex
CREATE INDEX "class_templates_tutorId_idx" ON "class_templates"("tutorId");

-- CreateIndex
CREATE INDEX "classes_tutorId_idx" ON "classes"("tutorId");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "classes"("status");

-- CreateIndex
CREATE INDEX "class_lessons_classId_idx" ON "class_lessons"("classId");

-- CreateIndex
CREATE INDEX "class_lessons_recipeId_idx" ON "class_lessons"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "class_lessons_classId_order_key" ON "class_lessons"("classId", "order");

-- CreateIndex
CREATE INDEX "class_versions_class_id_idx" ON "class_versions"("class_id");

-- CreateIndex
CREATE INDEX "class_versions_slug_idx" ON "class_versions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "class_versions_class_id_version_key" ON "class_versions"("class_id", "version");

-- CreateIndex
CREATE INDEX "class_version_lessons_class_version_id_idx" ON "class_version_lessons"("class_version_id");

-- CreateIndex
CREATE INDEX "class_version_lessons_recipeId_idx" ON "class_version_lessons"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "class_version_lessons_class_version_id_order_key" ON "class_version_lessons"("class_version_id", "order");

-- AddForeignKey
ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_templates" ADD CONSTRAINT "class_templates_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_class_template_id_fkey" FOREIGN KEY ("class_template_id") REFERENCES "class_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_lessons" ADD CONSTRAINT "class_lessons_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_lessons" ADD CONSTRAINT "class_lessons_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_versions" ADD CONSTRAINT "class_versions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_version_lessons" ADD CONSTRAINT "class_version_lessons_class_version_id_fkey" FOREIGN KEY ("class_version_id") REFERENCES "class_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_version_lessons" ADD CONSTRAINT "class_version_lessons_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
