import { listUsers } from "./lib/firebase/admin-rest";

async function test() {
  console.log("Testing listUsers...");
  try {
    const res = await listUsers(10);
    console.log("Users returned:", res.users.length);
    console.log("Sample user:", res.users[0]);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

test();
