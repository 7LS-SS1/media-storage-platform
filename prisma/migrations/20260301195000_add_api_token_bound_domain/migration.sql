-- Add optional bound domain for API tokens (token-domain binding)
ALTER TABLE "api_tokens"
ADD COLUMN "bound_domain" TEXT;

CREATE INDEX "api_tokens_bound_domain_idx"
ON "api_tokens"("bound_domain");
