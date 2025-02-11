import db from './db'
import { accounts } from './db/schema'
import { eq } from 'drizzle-orm'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export class TripleWhaleClient {
  private static async refreshTokens(teamId: string, refreshToken: string): Promise<TokenResponse> {
    const response = await fetch('https://api.triplewhale.com/api/v2/auth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.TRIPLEWHALE_CLIENT_ID!,
        client_secret: process.env.TRIPLEWHALE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString()
    });

    if (!response.ok) {
      throw new Error('Failed to refresh tokens');
    }

    const tokens = await response.json();

    // Update tokens in database
    const now = new Date();
    await db.update(accounts)
      .set({
        tripleWhaleAccessToken: tokens.access_token,
        tripleWhaleRefreshToken: tokens.refresh_token,
        tripleWhaleAccessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
        tripleWhaleRefreshTokenExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updatedAt: now
      })
      .where(eq(accounts.id, teamId));

    return tokens;
  }

  static async getValidAccessToken(teamId: string): Promise<string> {
    const workspace = await db.query.accounts.findFirst({
      where: eq(accounts.id, teamId)
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const now = new Date();

    // Check if access token is expired or will expire in the next 5 minutes
    if (!workspace.tripleWhaleAccessToken ||
      !workspace.tripleWhaleAccessTokenExpiresAt ||
      workspace.tripleWhaleAccessTokenExpiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {

      // Check if refresh token is valid
      if (!workspace.tripleWhaleRefreshToken ||
        !workspace.tripleWhaleRefreshTokenExpiresAt ||
        workspace.tripleWhaleRefreshTokenExpiresAt < now) {
        throw new Error('Refresh token expired. User needs to reauthenticate.');
      }

      // Refresh the tokens
      const tokens = await this.refreshTokens(teamId, workspace.tripleWhaleRefreshToken);
      return tokens.access_token;
    }

    return workspace.tripleWhaleAccessToken;
  }

  static async getSignInToken(teamId: string): Promise<string> {
    console.log('teamId', teamId)
    const workspace = await db.query.accounts.findFirst({
      where: eq(accounts.id, teamId)
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const response = await fetch('https://api.triplewhale.com/api/v2/orcabase/dev/sign-in-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ORCABASE_API_KEY!
      },
      body: JSON.stringify({
        accountId: workspace.id,
        appId: process.env.TRIPLEWHALE_CLIENT_ID!
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get sign-in token');
    }

    const data = await response.json();
    return data.token;
  }

  static async getIntegrationsUrl(teamId: string): Promise<string> {
    console.log('teamId', teamId)
    const workspace = await db.query.accounts.findFirst({
      where: eq(accounts.id, teamId)
    });

    console.log('workspace', workspace)

    if (!workspace || !workspace.id) {
      throw new Error('Workspace not found or not properly connected');
    }

    const signInToken = await this.getSignInToken(teamId);

    const params = new URLSearchParams({
      'account-id': workspace.id,
      'app-id': process.env.TRIPLEWHALE_CLIENT_ID!,
      'token': signInToken
    });

    return `https://app.triplewhale.com/orcabase/integrations?${params.toString()}`;
  }
} 