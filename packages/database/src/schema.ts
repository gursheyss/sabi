import { sql } from "drizzle-orm";
import {
  text,
  timestamp,
  pgTable,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});


export const slackWorkspaces = pgTable('slack_workspaces', {
  id: text('id').primaryKey(),
  name: text('name'),
  slackBotToken: text('slack_bot_token'),
  slackBotId: text('slack_bot_id'),
  slackBotUserId: text('slack_bot_user_id'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const tripleWhaleAccounts = pgTable('triple_whale_accounts', {
  id: text('id').primaryKey(),
  name: text('name'),
  tripleWhaleAccessToken: text('triple_whale_access_token'),
  tripleWhaleRefreshToken: text('triple_whale_refresh_token'),
  tripleWhaleAccessTokenExpiresAt: timestamp('triple_whale_access_token_expires_at'),
  tripleWhaleRefreshTokenExpiresAt: timestamp('triple_whale_refresh_token_expires_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceConnections = pgTable('workspace_connections', {
  slackWorkspaceId: text('slack_workspace_id').notNull().references(() => slackWorkspaces.id),
  tripleWhaleAccountId: text('triple_whale_account_id').notNull().references(() => tripleWhaleAccounts.id),
  isDefault: text('is_default').default('false'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey(table.slackWorkspaceId, table.tripleWhaleAccountId),
}));
