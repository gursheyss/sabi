"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@sabi/database";
import { brands } from "@sabi/database/src/schema";
import { eq, and, ne } from "drizzle-orm";
import { slackWorkspaces } from "@sabi/database/src/schema";
import { workspaceBrands } from "@sabi/database/src/schema";
import { TripleWhaleClient } from "@sabi/triplewhale";

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

  return workspace;
}

export async function createBrand(data: { name: string; website: string }) {
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