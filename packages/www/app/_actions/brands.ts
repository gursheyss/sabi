"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@sabi/database";
import { brands } from "@sabi/database/src/schema";
import { eq, and, ne } from "drizzle-orm";
import { slackWorkspaces } from "@sabi/database/src/schema";
import { workspaceBrands } from "@sabi/database/src/schema";
import { TripleWhaleClient } from "@sabi/triplewhale";
import { channelBrandMappings } from "@sabi/database/src/schema";
import { nanoid } from "nanoid";
import { WebClient } from "@slack/web-api";

export async function getBrands() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return db.query.brands.findMany({
    where: eq(brands.userId, session.user.id),
  });
}

export async function getConnectedSlackWorkspace() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const workspace = await db.query.slackWorkspaces.findFirst({
    where: eq(slackWorkspaces.userId, session.user.id),
  });

  if (!workspace) {
    return null;
  }

  const channels = await db.query.channelBrandMappings.findMany({
    where: eq(channelBrandMappings.workspaceId, workspace.id),
  });

  return {
    ...workspace,
    channels,
  };
}

export async function createBrand(data: { name: string; website: string; channelId: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const workspace = await getConnectedSlackWorkspace();
  if (!workspace) {
    throw new Error("Please connect to Slack before creating a brand");
  }

  const accountId = `${session.user.email.split('@')[0]}_${data.name}_sabi`;

  console.log('accountId', accountId);

  try {
    const registrationResponse = await fetch('https://api.triplewhale.com/api/v2/orcabase/dev/register-account', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': process.env.ORCABASE_API_KEY!
      },
      body: JSON.stringify({
        appId: process.env.TRIPLEWHALE_CLIENT_ID!,
        accountId: accountId,
        accountName: accountId,
        timezone: 'America/New_York',
        currency: 'USD'
      })
    });

    if (!registrationResponse.ok) {
      const error = await registrationResponse.text();
      console.error('Failed to register with Triple Whale', error);
      throw new Error('Failed to register with Triple Whale');
    }

    const params = new URLSearchParams({
      client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
      redirect_uri: process.env.REDIRECT_URI!,
      response_type: 'code',
      scope: 'offline_access offline',
      account_id: accountId,
      state: accountId
    });

    await db.insert(brands).values({
      id: accountId,
      name: data.name,
      website: data.website,
      userId: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.insert(workspaceBrands).values({
      workspaceId: workspace.id,
      brandId: accountId,
      isDefault: 'true',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update the channel mapping
    const channel = workspace.channels.find(c => c.channelId === data.channelId);
    if (channel) {
      await db.update(channelBrandMappings)
        .set({
          brandId: accountId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(channelBrandMappings.channelId, data.channelId),
            eq(channelBrandMappings.workspaceId, workspace.id)
          )
        );
    }

    await db.update(workspaceBrands)
      .set({ isDefault: 'false' })
      .where(
        and(
          eq(workspaceBrands.workspaceId, workspace.id),
          ne(workspaceBrands.brandId, accountId)
        )
      );

    return {
      authUrl: `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`
    };

  } catch (error) {
    console.error('Error in Triple Whale setup:', error);
    throw error;
  }
}

export async function getIntegrationsUrl(brandId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, brandId),
  });

  if (!brand || brand.userId !== session.user.id) {
    throw new Error("Brand not found");
  }

  return TripleWhaleClient.getIntegrationsUrl(brandId);
}

export async function refreshBrandConnection(brandId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, brandId),
  });

  if (!brand || brand.userId !== session.user.id) {
    throw new Error("Brand not found");
  }

  const params = new URLSearchParams({
    client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URI!,
    response_type: 'code',
    scope: 'offline_access offline',
    account_id: brandId,
    state: brandId
  });

  return {
    authUrl: `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`
  };
}

export async function updateChannelMappings({
  brandId,
  workspaceId,
  channelIds,
}: {
  brandId: string;
  workspaceId: string;
  channelIds: string[];
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await db.delete(channelBrandMappings)
    .where(and(
      eq(channelBrandMappings.brandId, brandId),
      eq(channelBrandMappings.workspaceId, workspaceId)
    ));

  const workspace = await db.query.slackWorkspaces.findFirst({
    where: eq(slackWorkspaces.id, workspaceId),
  });

  if (!workspace?.slackBotToken) {
    throw new Error("Workspace not found or no bot token");
  }

  const slack = new WebClient(workspace.slackBotToken);
  const channelsResponse = await slack.conversations.list({
    types: "public_channel",
    exclude_archived: true,
  });

  const channelMap = new Map(
    channelsResponse.channels?.map((channel) => [
      channel.id,
      channel.name,
    ])
  );

  await Promise.all(
    channelIds.map(async (channelId) => {
      const channelName = channelMap.get(channelId);
      if (!channelName) return;

      await db.insert(channelBrandMappings).values({
        id: nanoid(),
        workspaceId,
        channelId,
        channelName,
        brandId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    })
  );

  return { success: true };
}

export async function getSlackChannels() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const workspace = await db.query.slackWorkspaces.findFirst({
    where: eq(slackWorkspaces.userId, session.user.id),
  });

  if (!workspace?.slackBotToken) {
    throw new Error("No Slack workspace connected");
  }

  const slack = new WebClient(workspace.slackBotToken);
  const channelsResponse = await slack.conversations.list({
    types: "public_channel",
    exclude_archived: true,
  });

  return channelsResponse.channels?.map((channel) => ({
    id: channel.id,
    name: channel.name,
  })) || [];
} 