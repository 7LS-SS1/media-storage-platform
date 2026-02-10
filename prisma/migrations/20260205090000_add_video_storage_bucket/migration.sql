-- Add storage bucket to videos
ALTER TABLE "videos" ADD COLUMN "storage_bucket" TEXT NOT NULL DEFAULT 'media';

-- Index for filtering by bucket
CREATE INDEX "videos_storage_bucket_idx" ON "videos"("storage_bucket");
