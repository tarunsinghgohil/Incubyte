import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";

describe("employee seed", () => {
  it("creates 10,000 unique records and repeats the same dataset", () => {
    const databasePath = process.env.DB_PATH;
    assert.ok(databasePath);

    execFileSync(process.execPath, ["--import", "tsx", "server/seed.ts"], {
      env: process.env,
      encoding: "utf8",
    });

    const seededDb = new Database(databasePath, { readonly: true });
    try {
      const counts = seededDb.prepare(`
        SELECT COUNT(*) AS employees,
          COUNT(DISTINCT employee_code) AS codes,
          COUNT(DISTINCT email) AS emails,
          COUNT(DISTINCT updated_at) AS timestamps
        FROM employees
      `).get() as { employees: number; codes: number; emails: number; timestamps: number };
      const snapshot = () => seededDb.prepare(`
        SELECT employee_code,first_name,last_name,email,department,country,currency,
          salary_minor,job_title,start_date,updated_at
        FROM employees ORDER BY id
      `).all();
      const firstSeedHash = createHash("sha256").update(JSON.stringify(snapshot())).digest("hex");

      execFileSync(process.execPath, ["--import", "tsx", "server/seed.ts"], {
        env: process.env,
        encoding: "utf8",
      });
      const secondSeedHash = createHash("sha256").update(JSON.stringify(snapshot())).digest("hex");

      assert.deepEqual(counts, {
        employees: 10_000,
        codes: 10_000,
        emails: 10_000,
        timestamps: 1,
      });
      assert.equal(firstSeedHash, secondSeedHash);
    } finally {
      seededDb.close();
    }
  });
});
