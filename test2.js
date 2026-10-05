const crypto = require("crypto");

const saStr = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
const sa = JSON.parse(Buffer.from(saStr, "base64").toString("utf-8"));

function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const claims = JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit",
  });
  const h = Buffer.from(header).toString("base64url");
  const c = Buffer.from(claims).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${h}.${c}`);
  const sig = sign.sign(sa.private_key, "base64url");
  return `${h}.${c}.${sig}`;
}

async function run() {
  const jwt = createJWT();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  
  const projectId = sa.project_id;
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?maxResults=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  console.log("Keys in response:", Object.keys(data));
  if (data.users) console.log("Has data.users, length:", data.users.length);
  if (data.userInfo) console.log("Has data.userInfo, length:", data.userInfo.length);
}
run();
