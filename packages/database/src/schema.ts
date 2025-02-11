import { sql } from "drizzle-orm";
import {
  text,
  timestamp,
  pgTable,
  primaryKey,
} from "drizzle-orm/pg-core";

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
