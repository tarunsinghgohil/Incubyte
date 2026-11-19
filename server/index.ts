import { assertDemoAccessConfigured } from "./access.js";
import { app } from "./app.js";
import { initialize } from "./db.js";

assertDemoAccessConfigured();
initialize();

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

app.listen(port, "0.0.0.0", () => console.log(`ACME Compensation Hub listening on port ${port}`));
