ALTER TABLE "videos"
ADD COLUMN "target_keyword" TEXT NOT NULL DEFAULT '';

CREATE INDEX "videos_target_keyword_idx" ON "videos"("target_keyword");
