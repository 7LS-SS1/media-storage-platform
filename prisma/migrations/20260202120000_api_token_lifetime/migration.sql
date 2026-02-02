-- Allow API tokens to be lifetime (no expiration)
ALTER TABLE "api_tokens" ALTER COLUMN "expires_at" DROP NOT NULL;
