const {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  index,
} = require("drizzle-orm/pg-core");

// This definition matches the existing public.users table in Supabase.
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 255 }).notNull(),
  passwordHash: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
}));

module.exports = { users, refreshTokens };
