import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import db from "@lighthouse/database";
import { tripleWhaleAccounts, brands } from "@lighthouse/database/src/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const authResponse = await auth.handler(req);
  if (authResponse.status !== 200) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const authData = await authResponse.json();
  const userId = authData.user?.id;
  if (!userId) {
    return new NextResponse("User not found", { status: 401 });
  }

  try {
    const userBrands = await db.query.brands.findMany({
      where: eq(brands.userId, userId),
      with: {
        tripleWhaleAccount: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      brands: userBrands
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch brands' 
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authResponse = await auth.handler(req);
  if (authResponse.status !== 200) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const authData = await authResponse.json();
  const userId = authData.user?.id;
  if (!userId) {
    return new NextResponse("User not found", { status: 401 });
  }

  try {
    const { name, website } = await req.json();
    const accountId = `lighthouse_${Date.now()}`;
    const brandId = `brand_${Date.now()}`;

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
          accountName: name,
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

    const now = new Date();

    // Create Triple Whale account record
    await db.insert(tripleWhaleAccounts).values({
      id: accountId,
      name,
      createdAt: now,
      updatedAt: now,
    });

    // Create brand record
    await db.insert(brands).values({
      id: brandId,
      name,
      website,
      userId,
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

    const authUrl = `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${params.toString()}`;

    return NextResponse.json({ 
      success: true, 
      brandId,
      accountId,
      authUrl
    });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create brand' 
    }, { status: 500 });
  }
} 