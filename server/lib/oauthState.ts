import crypto from 'crypto';

const SECRET = process.env.OAUTH_STATE_SECRET!;

export function signState(payload: Record<string, any>) {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  return Buffer.from(JSON.stringify({ json, sig })).toString('base64url');
}

export function verifyState(token: string) {
  const { json, sig } = JSON.parse(Buffer.from(token, 'base64url').toString());
  const check = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  if (check !== sig) throw new Error('bad state');
  return JSON.parse(json);
}