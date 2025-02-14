"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@lighthouse/database";
import { brands } from "@lighthouse/database/src/schema";
import { eq } from "drizzle-orm";
import { slackWorkspaces } from "@lighthouse/database/src/schema";

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

  const accountId = `${session.user.email.split('@')[0]}_${data.name}_lighthouse`;

  try {
    // Register account with Triple Whale
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
        accountName: data.name,
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
      account_id: accountId
    });

    const authResponse = await fetch(`https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`);

    if (!authResponse.ok) {
      const error = await authResponse.text();
      console.error('Failed to get auth url', error);
      throw new Error('Failed to get auth url');
    }

    return await authResponse.json();

  } catch (error) {
    console.error('Error in Triple Whale setup:', error);
    throw error;
  }
} 