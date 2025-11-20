import * as crypto from "crypto";
export function randomString(len = 64) {
    return crypto.randomBytes(len).toString("base64url").replace(/_/g, "-").replace(/\./g, "");
}
export function sha256base64url(input) {
    return crypto.createHash("sha256").update(input).digest("base64url");
}
export function makePkce() {
    const code_verifier = randomString(64);
    const code_challenge = sha256base64url(code_verifier);
    return { code_verifier, code_challenge, method: "S256" };
}
