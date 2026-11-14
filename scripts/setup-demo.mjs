import fs from "node:fs";
import { randomBytes } from "node:crypto";
if (fs.existsSync(".env.local")) {
  console.log(
    ".env.local exists; left unchanged. Enable PROBE_DEMO_ENABLED and set SESSION_SECRET to use demo mode.",
  );
} else {
  fs.writeFileSync(
    ".env.local",
    `PROBE_DEMO_ENABLED=true\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nAPP_URL=http://localhost:3000\n`,
    { flag: "wx" },
  );
  console.log(
    "Created ignored .env.local with a random local session secret. No external services are activated.",
  );
}
