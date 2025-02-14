import db from '@sabi/database'
import { brands } from '@sabi/database/src/schema'
import { eq } from 'drizzle-orm'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

interface TokenErrorResponse {
  error: string
  error_description?: string
}

export class TripleWhaleClient {
  private static async refreshTokens(brandId: string, refreshToken: string): Promise<TokenResponse> {
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
      const errorData = await response.json() as TokenErrorResponse;
      if (errorData.error === 'invalid_grant') {
        throw new Error('Refresh token expired. User needs to reauthenticate.');
      }
      throw new Error(`Failed to refresh tokens: ${errorData.error_description || errorData.error}`);
    }

    const tokens = await response.json() as TokenResponse;

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
      throw new Error('Invalid token response from Triple Whale');
    }

    // Update tokens in database
    const now = new Date();
    await db.update(brands)
      .set({
        tripleWhaleAccessToken: tokens.access_token,
        tripleWhaleRefreshToken: tokens.refresh_token,
        tripleWhaleAccessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
        tripleWhaleRefreshTokenExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updatedAt: now
      })
      .where(eq(brands.id, brandId));

    return tokens;
  }

  static async getValidAccessToken(brandId: string): Promise<string> {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId)
    });

    if (!brand) {
      throw new Error('Brand not found');
    }

    const now = new Date();

    // Check if access token is expired or will expire in the next 5 minutes
    if (!brand.tripleWhaleAccessToken ||
      !brand.tripleWhaleAccessTokenExpiresAt ||
      brand.tripleWhaleAccessTokenExpiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {

      // Check if refresh token is valid
      if (!brand.tripleWhaleRefreshToken ||
        !brand.tripleWhaleRefreshTokenExpiresAt ||
        brand.tripleWhaleRefreshTokenExpiresAt < now) {
        throw new Error('Refresh token expired. User needs to reauthenticate.');
      }

      // Refresh the tokens
      const tokens = await this.refreshTokens(brandId, brand.tripleWhaleRefreshToken);
      return tokens.access_token;
    }

    return brand.tripleWhaleAccessToken;
  }

  static async getSignInToken(brandId: string): Promise<string> {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId)
    });

    if (!brand) {
      throw new Error('Brand not found');
    }

    const response = await fetch('https://api.triplewhale.com/api/v2/orcabase/dev/sign-in-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ORCABASE_API_KEY!
      },
      body: JSON.stringify({
        accountId: brandId,
        appId: process.env.TRIPLEWHALE_CLIENT_ID!
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get sign-in token');
    }

    const data = await response.json();
    return data.token;
  }

  static async getIntegrationsUrl(brandId: string): Promise<string> {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId)
    });

    if (!brand) {
      throw new Error('Brand not found');
    }

    const signInToken = await this.getSignInToken(brandId);

    const params = new URLSearchParams({
      'account-id': brandId,
      'app-id': process.env.TRIPLEWHALE_CLIENT_ID!,
      'token': signInToken
    });

    return `https://app.triplewhale.com/orcabase/integrations?${params.toString()}`;
  }
} 