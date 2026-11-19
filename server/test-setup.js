import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testDataDirectory = mkdtempSync(join(tmpdir(), "acme-compensation-test-"));
process.env.DB_PATH = join(testDataDirectory, "acme.db");
const { db } = await import("./db.ts");

process.on("exit", () => {
  db.close();
  rmSync(testDataDirectory, { recursive: true, force: true });
});
