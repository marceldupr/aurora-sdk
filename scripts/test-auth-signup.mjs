/**
 * One-off test: sign up a user via SDK using env from aurora-starter-ecom/.env.local.
 * Run from aurora-sdk: node scripts/test-auth-signup.mjs
 * Loads ../aurora-starter-ecom/.env.local so we don't hardcode secrets.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AuroraClient } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../../aurora-starter-ecom/.env.local");

if (!existsSync(envPath)) {
  console.error("Missing", envPath);
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  process.env[key] = val;
}

const baseUrl = process.env.AURORA_API_URL || process.env.NEXT_PUBLIC_AURORA_API_URL;
const apiKey = process.env.AURORA_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("Need AURORA_API_URL and AURORA_API_KEY in .env.local");
  process.exit(1);
}

const client = new AuroraClient({ baseUrl, apiKey });
const email = `sdk-test-${Date.now()}@example.com`;
const password = "test-password-123";

console.log("Signing up with SDK:", baseUrl, "email:", email);

try {
  const result = await client.auth.signup({ email, password });
  console.log("Signup result:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Signup failed:", err.message);
  if (err.cause) console.error("Cause:", err.cause);
  process.exit(1);
}
