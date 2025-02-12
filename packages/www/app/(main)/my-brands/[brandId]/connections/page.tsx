import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import db from "@lighthouse/database";
import { brands, tripleWhaleAccounts } from "@lighthouse/database/src/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";

interface Brand {
  id: string;
  name: string;
  website: string;
  tripleWhaleAccountId: string | null;
  tripleWhaleAccount: typeof tripleWhaleAccounts.$inferSelect | null;
}

export default async function BrandConnectionsPage({
  params,
}: {
  params: { brandId: string };
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const brand = (await db.query.brands.findFirst({
    where: eq(brands.id, params.brandId),
    with: {
      tripleWhaleAccount: true,
    },
  })) as Brand | undefined;

  if (!brand) {
    redirect("/my-brands");
  }

  // Generate Triple Whale auth URL if not connected
  const queryParams = new URLSearchParams({
    client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
    redirect_uri: process.env.REDIRECT_URI!,
    response_type: "code",
    scope: "offline_access offline",
    account_id: brand.tripleWhaleAccountId!,
  });

  const tripleWhaleAuthUrl = `https://api.triplewhale.com/api/v2/orcabase/dev/auth?${queryParams.toString()}`;

  return (
    <div className="p-4 pt-0">
      <h1 className="text-2xl font-bold mb-6">
        Manage Connections for {brand.name}
      </h1>

      <div className="grid gap-6">
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">
            Triple Whale Integration
          </h2>
          <p className="text-muted-foreground mb-4">
            Connect your Triple Whale account to access analytics and insights.
          </p>
          {brand.tripleWhaleAccount?.tripleWhaleAccessToken ? (
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓ Connected</span>
              <Button
                variant="outline"
                onClick={() => window.open(tripleWhaleAuthUrl, "_blank")}
              >
                Reconnect
              </Button>
            </div>
          ) : (
            <Button onClick={() => window.open(tripleWhaleAuthUrl, "_blank")}>
              Connect Triple Whale
            </Button>
          )}
        </div>

        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Slack Integration</h2>
          <p className="text-muted-foreground mb-4">
            Connect your Slack workspace to receive notifications and updates.
          </p>
          <Button variant="outline">Coming Soon</Button>
        </div>
      </div>
    </div>
  );
}
