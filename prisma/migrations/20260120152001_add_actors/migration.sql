-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "VideoVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'DOMAIN_RESTRICTED');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "video_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "duration" INTEGER,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "visibility" "VideoVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "VideoStatus" NOT NULL DEFAULT 'PROCESSING',
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_domains" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_allowed_domains" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,

    CONSTRAINT "video_allowed_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_last4" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ActorToVideo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ActorToVideo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "videos_category_id_idx" ON "videos"("category_id");

-- CreateIndex
CREATE INDEX "videos_created_by_id_idx" ON "videos"("created_by_id");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_visibility_idx" ON "videos"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "actors_name_key" ON "actors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_domains_domain_key" ON "allowed_domains"("domain");

-- CreateIndex
CREATE INDEX "video_allowed_domains_video_id_idx" ON "video_allowed_domains"("video_id");

-- CreateIndex
CREATE INDEX "video_allowed_domains_domain_id_idx" ON "video_allowed_domains"("domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_allowed_domains_video_id_domain_id_key" ON "video_allowed_domains"("video_id", "domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_created_by_id_idx" ON "api_tokens"("created_by_id");

-- CreateIndex
CREATE INDEX "api_tokens_expires_at_idx" ON "api_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "_ActorToVideo_B_index" ON "_ActorToVideo"("B");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_allowed_domains" ADD CONSTRAINT "video_allowed_domains_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_allowed_domains" ADD CONSTRAINT "video_allowed_domains_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "allowed_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActorToVideo" ADD CONSTRAINT "_ActorToVideo_A_fkey" FOREIGN KEY ("A") REFERENCES "actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActorToVideo" ADD CONSTRAINT "_ActorToVideo_B_fkey" FOREIGN KEY ("B") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
