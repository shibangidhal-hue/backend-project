CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");
