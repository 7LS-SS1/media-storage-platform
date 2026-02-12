-- CreateTable
CREATE TABLE "video_views" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "viewer_key" TEXT NOT NULL,
    "view_bucket" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_views_video_id_created_at_idx" ON "video_views"("video_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "video_views_video_id_viewer_key_view_bucket_key" ON "video_views"("video_id", "viewer_key", "view_bucket");

-- AddForeignKey
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
