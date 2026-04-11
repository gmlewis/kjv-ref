#!/usr/bin/env bun
/**
 * scripts/grab-session.ts
 *
 * Reads your existing Google-authenticated session from Chrome's cookie
 * database on macOS and writes it to e2e/.auth/state.json so Playwright
 * can reuse it without going through OAuth.
 *
 * Requirements:
 *   - macOS (uses the Keychain to decrypt Chrome cookies)
 *   - Chrome must NOT be running (or at least not writing to the DB)
 *   - You must already be logged in on preview.prophet.do in Chrome
 *
 * Usage:
 *   bun run scripts/grab-session.ts
 *   # or via the wrapper:
 *   ./scripts/e2e-login.sh
 */

import { Database } from "bun:sqlite";
import { execSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";

const CHROME_COOKIES_DB = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome/Default/Cookies"
);
const TEMP_DB = "/tmp/playwright-chrome-cookies.db";
const STATE_FILE = path.join(import.meta.dirname, "../e2e/.auth/state.json");
const HOST_PATTERN = "prophet.do";

// ── 1. Get Chrome's encryption key from macOS Keychain ───────────────────────

let keychainPassword: string;
try {
  keychainPassword = execSync(
    'security find-generic-password -a "Chrome" -s "Chrome Safe Storage" -w',
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
} catch {
  console.error(
    "\n✗ Could not read Chrome Safe Storage from Keychain.\n" +
    "  Make sure you are running this on macOS with Chrome installed.\n"
  );
  process.exit(1);
}

// Chrome derives a 16-byte AES-128 key via PBKDF2-SHA1 (1003 iterations, salt = "saltysalt")
const encryptionKey = crypto.pbkdf2Sync(
  keychainPassword,
  "saltysalt",
  1003,
  16,
  "sha1"
);

// ── 2. Copy the SQLite DB so we don't fight Chrome for the lock ──────────────

if (!fs.existsSync(CHROME_COOKIES_DB)) {
  console.error(
    `\n✗ Chrome cookies database not found at:\n  ${CHROME_COOKIES_DB}\n`
  );
  process.exit(1);
}

fs.copyFileSync(CHROME_COOKIES_DB, TEMP_DB);

// ── 3. Query cookies for preview.prophet.do ──────────────────────────────────

const db = new Database(TEMP_DB, { readonly: true });

interface ChromeCookieRow {
  name: string;
  value: string;
  encrypted_value: Buffer | null;
  host_key: string;
  path: string;
  expires_utc: number;
  is_httponly: number;
  is_secure: number;
  samesite: number;
}

const rows = db
  .query<ChromeCookieRow, []>(
    `SELECT name, value, encrypted_value, host_key, path,
            expires_utc, is_httponly, is_secure, samesite
     FROM cookies
     WHERE host_key LIKE '%${HOST_PATTERN}%'`
  )
  .all();

db.close();
fs.unlinkSync(TEMP_DB);

if (rows.length === 0) {
  console.error(
    `\n✗ No cookies found for *${HOST_PATTERN}*.\n` +
    "  Make sure you are logged in on https://preview.prophet.do in Chrome.\n"
  );
  process.exit(1);
}

// ── 4. Decrypt each cookie ───────────────────────────────────────────────────

function decryptChromeValue(encrypted: Buffer): string {
  // Chrome on macOS prefixes encrypted values with "v10"
  if (encrypted.length < 3) return "";
  const prefix = encrypted.slice(0, 3).toString();
  if (prefix !== "v10") {
    // Not encrypted (older Chrome format)
    return encrypted.toString("utf8");
  }
  const iv = Buffer.alloc(16, " "); // Chrome uses 16 spaces as IV
  const ciphertext = encrypted.slice(3);
  const decipher = crypto.createDecipheriv("aes-128-cbc", encryptionKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// Chrome samesite column: -1/0 = no restriction (None), 1 = Lax, 2 = Strict, 3 = Lax
function sameSiteLabel(n: number): "Strict" | "Lax" | "None" {
  if (n === 2) return "Strict";
  if (n === 1 || n === 3) return "Lax";
  return "None";
}

// Chrome epoch is microseconds since 1601-01-01; Unix is seconds since 1970-01-01
const CHROME_EPOCH_OFFSET = 11_644_473_600n; // seconds
function chromeToUnix(chromeMicros: number): number {
  if (chromeMicros === 0) return -1;
  return Number(BigInt(chromeMicros) / 1_000_000n - CHROME_EPOCH_OFFSET);
}

const cookies = rows.map((row) => {
  const value =
    row.encrypted_value && row.encrypted_value.length > 0
      ? decryptChromeValue(row.encrypted_value)
      : row.value;

  return {
    name: row.name,
    value,
    domain: row.host_key,
    path: row.path,
    expires: chromeToUnix(row.expires_utc),
    httpOnly: row.is_httponly === 1,
    secure: row.is_secure === 1,
    sameSite: sameSiteLabel(row.samesite),
  };
});

// ── 5. Write Playwright storageState ─────────────────────────────────────────

const storageState = { cookies, origins: [] };

fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
fs.writeFileSync(STATE_FILE, JSON.stringify(storageState, null, 2));

console.log(
  `\n✓ Saved ${cookies.length} cookies for *${HOST_PATTERN}* → ${STATE_FILE}`
);
console.log("  You can now run: bun run e2e\n");
