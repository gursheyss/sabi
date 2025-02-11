ALTER TABLE "accounts" RENAME COLUMN "access_token" TO "triple_whale_access_token";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "refresh_token" TO "triple_whale_refresh_token";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "access_token_expires_at" TO "triple_whale_access_token_expires_at";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "refresh_token_expires_at" TO "triple_whale_refresh_token_expires_at";