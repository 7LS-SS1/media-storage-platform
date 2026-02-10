-- Add AV/movie metadata fields
ALTER TABLE "videos" ADD COLUMN "movie_code" TEXT;
ALTER TABLE "videos" ADD COLUMN "studio" TEXT;
ALTER TABLE "videos" ADD COLUMN "release_date" TIMESTAMP(3);
