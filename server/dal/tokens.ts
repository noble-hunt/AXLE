import { db } from '../db.js';
import { wearableTokens } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { seal, open } from '../lib/crypto.js';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export async function storeEncryptedTokens(
  userId: string,
  provider: string,
  tokens: TokenData
): Promise<void> {
  const encryptedAccessToken = seal(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken ? seal(tokens.refreshToken) : null;

  // Check if tokens already exist for this user/provider
  const existing = await db
    .select()
    .from(wearableTokens)
    .where(and(
      eq(wearableTokens.userId, userId),
      eq(wearableTokens.provider, provider)
    ))
    .limit(1);

  if (existing[0]) {
    // Update existing tokens
    await db
      .update(wearableTokens)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(wearableTokens.userId, userId),
        eq(wearableTokens.provider, provider)
      ));
  } else {
    // Insert new tokens
    await db
      .insert(wearableTokens)
      .values({
        userId,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      } as any);
  }
}

export async function getDecryptedTokens(
  userId: string,
  provider: string
): Promise<TokenData | null> {
  const tokenRecord = await db
    .select()
    .from(wearableTokens)
    .where(and(
      eq(wearableTokens.userId, userId),
      eq(wearableTokens.provider, provider)
    ))
    .limit(1);

  if (!tokenRecord[0]) {
    return null;
  }

  const record = tokenRecord[0];
  const accessToken = open(record.accessToken);
  const refreshToken = record.refreshToken ? open(record.refreshToken) : undefined;

  return {
    accessToken,
    refreshToken,
    expiresAt: record.expiresAt || undefined,
    scope: record.scope || undefined,
  };
}

export async function deleteTokens(userId: string, provider: string): Promise<void> {
  await db
    .delete(wearableTokens)
    .where(and(
      eq(wearableTokens.userId, userId),
      eq(wearableTokens.provider, provider)
    ));
}