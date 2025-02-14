import { eq } from "drizzle-orm";
import db from "..";
import { brands } from "../schema";

export async function getBrand(brandId: string) {
  return db.query.brands.findFirst({
    where: eq(brands.id, brandId),
  });
}

export async function updateBrandTokens(brandId: string, {
  accessToken,
  refreshToken,
  accessTokenExpiresAt,
  refreshTokenExpiresAt,
}: {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}) {
  return db.update(brands)
    .set({
      tripleWhaleAccessToken: accessToken,
      tripleWhaleRefreshToken: refreshToken,
      tripleWhaleAccessTokenExpiresAt: accessTokenExpiresAt,
      tripleWhaleRefreshTokenExpiresAt: refreshTokenExpiresAt,
      updatedAt: new Date()
    })
    .where(eq(brands.id, brandId));
} 