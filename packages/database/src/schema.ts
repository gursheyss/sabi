import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  text,
  timestamp,
  pgTable,
  primaryKey,
  boolean,
  unique,
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

export const userRelations = relations(user, ({ many }) => ({
  brands: many(brands),
  workspaces: many(workspaceUsers),
}));

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

export const workspaceUsers = pgTable('workspace_users', {
  workspaceId: text('workspace_id').notNull().references(() => slackWorkspaces.id),
  userId: text('user_id').notNull().references(() => user.id),
  role: text('role').notNull().default('member'), // Can be 'admin' or 'member'
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey(table.workspaceId, table.userId),
}));

export const slackWorkspacesRelations = relations(slackWorkspaces, ({ many }) => ({
  users: many(workspaceUsers),
  channels: many(channelBrandMappings),
}));

export const workspaceUsersRelations = relations(workspaceUsers, ({ one }) => ({
  workspace: one(slackWorkspaces, {
    fields: [workspaceUsers.workspaceId],
    references: [slackWorkspaces.id],
  }),
  user: one(user, {
    fields: [workspaceUsers.userId],
    references: [user.id],
  }),
}));

export const brands = pgTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  website: text('website').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  tripleWhaleAccessToken: text('triple_whale_access_token'),
  tripleWhaleRefreshToken: text('triple_whale_refresh_token'),
  tripleWhaleAccessTokenExpiresAt: timestamp('triple_whale_access_token_expires_at'),
  tripleWhaleRefreshTokenExpiresAt: timestamp('triple_whale_refresh_token_expires_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const brandsRelations = relations(brands, ({ one }) => ({
  user: one(user, {
    fields: [brands.userId],
    references: [user.id],
  }),
}));

export const workspaceBrands = pgTable('workspace_brands', {
  workspaceId: text('workspace_id').notNull().references(() => slackWorkspaces.id),
  brandId: text('brand_id').notNull().references(() => brands.id),
  isDefault: text('is_default').default('false'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey(table.workspaceId, table.brandId),
}));

export const channelBrandMappings = pgTable('channel_brand_mappings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => slackWorkspaces.id),
  channelId: text('channel_id').notNull(),
  channelName: text('channel_name').notNull(),
  brandId: text('brand_id').references(() => brands.id),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  workspaceChannelUnq: unique().on(table.workspaceId, table.channelId)
}));

export const channelBrandMappingsRelations = relations(channelBrandMappings, ({ one }) => ({
  workspace: one(slackWorkspaces, {
    fields: [channelBrandMappings.workspaceId],
    references: [slackWorkspaces.id],
  }),
  brand: one(brands, {
    fields: [channelBrandMappings.brandId],
    references: [brands.id],
  }),
}));

export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type SlackWorkspace = InferSelectModel<typeof slackWorkspaces>;
export type Brand = InferSelectModel<typeof brands>;
export type WorkspaceBrand = InferSelectModel<typeof workspaceBrands>;
export type ChannelBrandMapping = InferSelectModel<typeof channelBrandMappings>;
export type WorkspaceUser = InferSelectModel<typeof workspaceUsers>;
