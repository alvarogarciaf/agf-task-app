import "server-only";
import { createSign, createVerify } from "crypto";
import { serviceAccountJson } from "./credentials";

// ── Types ──────────────────────────────────────────────────────────────

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

export interface DecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  [key: string]: any;
}

export interface UserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  disabled: boolean;
  metadata: {
    creationTime?: string;
    lastSignInTime?: string;
  };
  providerData: Array<{
    providerId: string;
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  }>;
}

export interface ListUsersResult {
  users: UserRecord[];
  pageToken?: string;
}

// ── Service Account ────────────────────────────────────────────────────

function resolveServiceAccount(): ServiceAccount | null {
  const raw = serviceAccountJson || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!raw) return null;

  let str = raw.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  try {
    const parsed = JSON.parse(str);
    if (parsed?.project_id && parsed?.private_key) return parsed;
  } catch {}

  try {
    const decoded = Buffer.from(str, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (parsed?.project_id && parsed?.private_key) return parsed;
  } catch {}

  return null;
}

const sa = resolveServiceAccount();
const projectId = sa?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "agf-task-manager";
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "agf-task-manager.firebasestorage.app";

// ── JWT / Access Token ─────────────────────────────────────────────────

function createServiceAccountJWT(scopes: string[]): string {
  if (!sa) throw new Error("No service account configured");
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const claims = JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: scopes.join(" "),
  });
  const h = Buffer.from(header).toString("base64url");
  const c = Buffer.from(claims).toString("base64url");
  const input = `${h}.${c}`;
  const sign = createSign("RSA-SHA256");
  sign.update(input);
  const sig = sign.sign(sa.private_key, "base64url");
  return `${input}.${sig}`;
}

let _cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_cached && Date.now() < _cached.expiresAt - 60_000) return _cached.token;

  const jwt = createServiceAccountJWT([
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
    "https://www.googleapis.com/auth/identitytoolkit",
  ]);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`Access token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  _cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return _cached.token;
}

// ── ID Token Verification ──────────────────────────────────────────────

let _keys: { keys: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  if (_keys && Date.now() < _keys.expiresAt) return _keys.keys;
  const res = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (!res.ok) throw new Error("Failed to fetch Google public keys");
  const cc = res.headers.get("cache-control") || "";
  const m = cc.match(/max-age=(\d+)/);
  const maxAge = m ? parseInt(m[1]) : 3600;
  const keys = await res.json();
  _keys = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

export async function verifyIdToken(idToken: string): Promise<DecodedToken> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [hB64, pB64, sB64] = parts;
  const header = JSON.parse(Buffer.from(hB64, "base64url").toString());
  const payload = JSON.parse(Buffer.from(pB64, "base64url").toString());

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error("Token expired");
  if (payload.iat && payload.iat > now + 300) throw new Error("Token issued in the future");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error(`Invalid issuer: ${payload.iss}`);
  if (payload.aud !== projectId) throw new Error(`Invalid audience: ${payload.aud}`);

  const keys = await getGooglePublicKeys();
  const pem = keys[header.kid];
  if (!pem) throw new Error(`No matching key for kid: ${header.kid}`);

  const verify = createVerify("RSA-SHA256");
  verify.update(`${hB64}.${pB64}`);
  if (!verify.verify(pem, Buffer.from(sB64, "base64url")))
    throw new Error("Invalid token signature");

  return { uid: payload.sub || payload.user_id, email: payload.email, email_verified: payload.email_verified, ...payload };
}

// ── Auth Admin (Identity Toolkit REST API) ─────────────────────────────

function mapUser(raw: any): UserRecord {
  return {
    uid: raw.localId,
    email: raw.email,
    displayName: raw.displayName,
    photoURL: raw.photoUrl,
    emailVerified: raw.emailVerified || false,
    disabled: raw.disabled || false,
    metadata: {
      creationTime: raw.createdAt ? new Date(parseInt(raw.createdAt)).toUTCString() : undefined,
      lastSignInTime: raw.lastLoginAt ? new Date(parseInt(raw.lastLoginAt)).toUTCString() : undefined,
    },
    providerData: (raw.providerUserInfo || []).map((p: any) => ({
      providerId: p.providerId,
      uid: p.rawId || p.federatedId,
      email: p.email,
      displayName: p.displayName,
      photoURL: p.photoUrl,
    })),
  };
}

const itk = (path: string) => `https://identitytoolkit.googleapis.com/v1/projects/${projectId}${path}`;

async function authPost(path: string, body: object) {
  const token = await getAccessToken();
  const res = await fetch(itk(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listUsers(maxResults: number = 1000, pageToken?: string): Promise<ListUsersResult> {
  const body: any = { maxResults };
  if (pageToken) body.nextPageToken = pageToken;
  const data = await authPost("/accounts:batchGet", body);
  return { users: (data.userInfo || []).map(mapUser), pageToken: data.nextPageToken };
}

export async function getUser(uid: string): Promise<UserRecord> {
  const data = await authPost("/accounts:lookup", { localId: [uid] });
  if (!data.users?.length) throw new Error(`User not found: ${uid}`);
  return mapUser(data.users[0]);
}

export async function deleteUser(uid: string): Promise<void> {
  await authPost("/accounts:delete", { localId: uid });
}

export async function createUser(props: { email: string; password: string; displayName?: string; emailVerified?: boolean }): Promise<UserRecord> {
  const body: any = { email: props.email, password: props.password };
  if (props.displayName) body.displayName = props.displayName;
  if (typeof props.emailVerified === "boolean") body.emailVerified = props.emailVerified;
  const data = await authPost("/accounts", body);
  // accounts endpoint returns localId directly
  return getUser(data.localId);
}

export async function updateUser(uid: string, updates: { disabled?: boolean; displayName?: string; emailVerified?: boolean }): Promise<void> {
  const body: any = { localId: uid };
  if (typeof updates.disabled === "boolean") body.disableUser = updates.disabled;
  if (typeof updates.displayName === "string") body.displayName = updates.displayName;
  if (typeof updates.emailVerified === "boolean") body.emailVerified = updates.emailVerified;
  await authPost("/accounts:update", body);
}

export async function generatePasswordResetLink(email: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email, returnOobLink: true }),
    }
  );
  if (!res.ok) throw new Error(`generatePasswordResetLink failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.oobLink;
}

// ── Firestore REST API ─────────────────────────────────────────────────

const fsBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function toFsVal(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === "object") {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFsVal(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromFsVal(v: any): any {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return parseInt(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFsVal);
  if ("mapValue" in v) {
    const r: Record<string, any> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = fromFsVal(val as any);
    return r;
  }
  return null;
}

function parseDoc(doc: any): Record<string, any> {
  if (!doc?.fields) return {};
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) r[k] = fromFsVal(v as any);
  return r;
}

export interface FirestoreDoc {
  exists: boolean;
  data: () => Record<string, any> | undefined;
  id: string;
  ref: { path: string };
}

export async function firestoreGet(docPath: string): Promise<FirestoreDoc> {
  const token = await getAccessToken();
  const res = await fetch(`${fsBase}/${docPath}`, { headers: { Authorization: `Bearer ${token}` } });
  const id = docPath.split("/").pop() || "";
  if (res.status === 404) return { exists: false, data: () => undefined, id, ref: { path: docPath } };
  if (!res.ok) throw new Error(`Firestore GET ${docPath}: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  const parsed = parseDoc(doc);
  return { exists: true, data: () => parsed, id, ref: { path: docPath } };
}

export async function firestoreSet(docPath: string, data: Record<string, any>): Promise<void> {
  const token = await getAccessToken();
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFsVal(v);
  const res = await fetch(`${fsBase}/${docPath}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore SET ${docPath}: ${res.status} ${await res.text()}`);
}

export async function firestoreList(collectionPath: string, options?: { select?: string[]; where?: { field: string; op: string; value: any }; limit?: number }): Promise<FirestoreDoc[]> {
  const token = await getAccessToken();

  // Use the REST API structured query via :runQuery
  const parentParts = collectionPath.split("/");
  const collectionId = parentParts.pop()!;
  const parent = parentParts.join("/");

  const structuredQuery: any = { from: [{ collectionId }] };

  if (options?.select) {
    structuredQuery.select = { fields: options.select.map((f) => ({ fieldPath: f })) };
  }

  if (options?.where) {
    const { field, op, value } = options.where;
    structuredQuery.where = {
      fieldFilter: { field: { fieldPath: field }, op, value: toFsVal(value) },
    };
  }

  if (options?.limit) {
    structuredQuery.limit = options.limit;
  }

  const parentUrl = parent ? `${fsBase}/${parent}` : fsBase;
  const res = await fetch(`${parentUrl}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) throw new Error(`Firestore query ${collectionPath}: ${res.status} ${await res.text()}`);

  const results = await res.json();
  const docs: FirestoreDoc[] = [];
  for (const r of results) {
    if (!r.document) continue;
    const fullPath = r.document.name as string;
    // Extract the document path relative to the database root
    const dbPrefix = `projects/${projectId}/databases/(default)/documents/`;
    const relPath = fullPath.includes(dbPrefix) ? fullPath.split(dbPrefix)[1] : fullPath;
    const id = relPath.split("/").pop() || "";
    const parsed = parseDoc(r.document);
    docs.push({ exists: true, data: () => parsed, id, ref: { path: relPath } });
  }
  return docs;
}

export async function firestoreDelete(docPath: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${fsBase}/${docPath}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore DELETE ${docPath}: ${res.status} ${await res.text()}`);
}

export async function firestoreBatchDelete(docPaths: string[]): Promise<void> {
  if (docPaths.length === 0) return;
  const token = await getAccessToken();
  const writes = docPaths.map((p) => ({
    delete: `projects/${projectId}/databases/(default)/documents/${p}`,
  }));

  // Firestore batch write has a limit of 500 per request
  for (let i = 0; i < writes.length; i += 500) {
    const batch = writes.slice(i, i + 500);
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ writes: batch }),
      }
    );
    if (!res.ok) throw new Error(`Firestore batchDelete: ${res.status} ${await res.text()}`);
  }
}

// ── Cloud Storage REST API ─────────────────────────────────────────────

export async function storageListFiles(prefix: string): Promise<Array<{ name: string; size: number }>> {
  const token = await getAccessToken();
  const files: Array<{ name: string; size: number }> = [];
  let pageToken: string | undefined;

  do {
    let url = `https://storage.googleapis.com/storage/v1/b/${storageBucket}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1000`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Storage list: ${res.status} ${await res.text()}`);
    const data = await res.json();
    for (const item of data.items || []) {
      files.push({ name: item.name, size: parseInt(item.size || "0") });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

export async function storageDeleteFiles(prefix: string): Promise<void> {
  const files = await storageListFiles(prefix);
  const token = await getAccessToken();
  // Delete in parallel, batches of 20
  for (let i = 0; i < files.length; i += 20) {
    const batch = files.slice(i, i + 20);
    await Promise.all(
      batch.map((f) =>
        fetch(`https://storage.googleapis.com/storage/v1/b/${storageBucket}/o/${encodeURIComponent(f.name)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );
  }
}
