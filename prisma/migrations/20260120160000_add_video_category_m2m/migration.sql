-- Create join table for Video <-> Category
CREATE TABLE "_CategoryToVideo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToVideo_AB_pkey" PRIMARY KEY ("A","B")
);

-- Backfill existing category_id values into the join table
INSERT INTO "_CategoryToVideo" ("A", "B")
SELECT "category_id", "id"
FROM "videos"
WHERE "category_id" IS NOT NULL;

-- Drop old single-category column and constraints
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_category_id_fkey";
DROP INDEX IF EXISTS "videos_category_id_idx";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "category_id";

-- Indexes and foreign keys for the join table
CREATE INDEX "_CategoryToVideo_B_index" ON "_CategoryToVideo"("B");

ALTER TABLE "_CategoryToVideo" ADD CONSTRAINT "_CategoryToVideo_A_fkey"
FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_CategoryToVideo" ADD CONSTRAINT "_CategoryToVideo_B_fkey"
FOREIGN KEY ("B") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
