// Grants or removes the internalAdmin custom claim (metadata-only org search at /admin).
// Operator-run, on your own machine. This is the only place the Admin SDK is used.
//
//   npm install --no-save firebase-admin@14.5.1
//   gcloud auth application-default login      (or set GOOGLE_APPLICATION_CREDENTIALS)
//   node scripts/set-admin.mjs <firebase-project-id> <email> [--remove]
//
// The user must sign out and back in for the claim to take effect.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [projectId, email, flag] = process.argv.slice(2);
if (!projectId || !email) {
  console.error(
    "Usage: node scripts/set-admin.mjs <project-id> <email> [--remove]",
  );
  process.exit(1);
}
initializeApp({ projectId, credential: applicationDefault() });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims ?? {}) };
if (flag === "--remove") delete claims.internalAdmin;
else claims.internalAdmin = true;
await auth.setCustomUserClaims(user.uid, claims);
console.log(
  `${flag === "--remove" ? "Removed" : "Granted"} internalAdmin for ${email} (${user.uid}).`,
);
