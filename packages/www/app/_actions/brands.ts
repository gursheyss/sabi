"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@lighthouse/database";
import { tripleWhaleAccounts, brands } from "@lighthouse/database/src/schema";
import { eq } from "drizzle-orm";

export async function getBrands() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return db.query.brands.findMany({
    where: eq(brands.userId, session.user.id),
    with: {
      tripleWhaleAccount: true
    }
  });
}

export async function createBrand(data: { name: string; website: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const accountId = `lighthouse_${Date.now()}`;
  const brandId = `brand_${Date.now()}`;
  const now = new Date();

  // Register with Triple Whale
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
        accountName: data.name,
        timezone: 'America/New_York',
        currency: 'USD'
      })
    });

    if (!registrationResponse.ok) {
      throw new Error('Failed to register with Triple Whale');
    }
  } catch (error) {
    console.log('Triple Whale registration error (might be already registered):', error);
  }

  // Create Triple Whale account record
  await db.insert(tripleWhaleAccounts).values({
    id: accountId,
    name: data.name,
    createdAt: now,
    updatedAt: now,
  });

  // Create brand record
  await db.insert(brands).values({
    id: brandId,
    name: data.name,
    website: data.website,
    userId: session.user.id,
    tripleWhaleAccountId: accountId,
    createdAt: now,
    updatedAt: now,
  });

  // Generate Triple Whale auth URL
  const params = new URLSearchParams({
    client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URI!,
    response_type: 'code',
    scope: 'offline_access offline',
    account_id: accountId
  });

  return {
    brandId,
    accountId,
    authUrl: `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`
  };
} 