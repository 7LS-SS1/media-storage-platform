ALTER TABLE "videos"
ADD COLUMN "delivery_provider" TEXT NOT NULL DEFAULT 'r2',
ADD COLUMN "bunny_video_id" TEXT;

CREATE UNIQUE INDEX "videos_bunny_video_id_key" ON "videos"("bunny_video_id");
