import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { assertDemoAccessConfigured } from "./access.js";
import { db, initialize } from "./db.js";
import { app } from "./app.js";

beforeEach(() => {
  initialize();
  db.exec("DELETE FROM salary_changes; DELETE FROM employees;");
  db.prepare(`
    INSERT INTO employees(
      employee_code,first_name,last_name,email,department,country,currency,
      salary_minor,job_title,start_date,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    "ACME-1",
    "Grace",
    "Hopper",
    "grace@acme.test",
    "Engineering",
    "United States",
    "USD",
    15_000_000,
    "Director",
    "2020-01-01",
    "2024-01-01",
  );
});

describe("employee API", () => {
  it("returns a paginated directory", async () => {
    const response = await request(app).get("/api/employees?page=1&pageSize=25");
    assert.equal(response.status, 200);
    assert.equal(response.body.meta.total, 1);
  });

  it("rejects an unreasoned salary update", async () => {
    const response = await request(app)
      .patch("/api/employees/1/salary")
      .send({ salaryMinor: 200 });
    assert.equal(response.status, 400);
  });

  it("updates salary through the API and records history", async () => {
    const response = await request(app)
      .patch("/api/employees/1/salary")
      .send({ salaryMinor: 17_500_000, reason: "Promotion to VP" });
    assert.equal(response.status, 200);
    assert.equal(response.body.history[0].reason, "Promotion to VP");
  });

  it("protects the demo when environment credentials are configured", async () => {
    const previousUsername = process.env.DEMO_USERNAME;
    const previousPassword = process.env.DEMO_PASSWORD;
    process.env.DEMO_USERNAME = "hr-demo";
    process.env.DEMO_PASSWORD = "not-a-production-secret";

    try {
      const denied = await request(app).get("/api/filters");
      assert.equal(denied.status, 401);
      assert.match(denied.headers["www-authenticate"], /^Basic/);

      const allowed = await request(app).get("/api/filters").auth("hr-demo", "not-a-production-secret");
      assert.equal(allowed.status, 200);

      const health = await request(app).get("/api/health");
      assert.equal(health.status, 200);
    } finally {
      if (previousUsername === undefined) delete process.env.DEMO_USERNAME;
      else process.env.DEMO_USERNAME = previousUsername;
      if (previousPassword === undefined) delete process.env.DEMO_PASSWORD;
      else process.env.DEMO_PASSWORD = previousPassword;
    }
  });

  it("requires demo credentials in production", () => {
    assert.throws(
      () => assertDemoAccessConfigured({ NODE_ENV: "production" }),
      /DEMO_USERNAME and DEMO_PASSWORD/,
    );
    assert.doesNotThrow(() => assertDemoAccessConfigured({
      NODE_ENV: "production",
      DEMO_USERNAME: "hr-demo",
      DEMO_PASSWORD: "configured-outside-the-repository",
    }));
  });

  it("fails closed if production access credentials are missing", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousUsername = process.env.DEMO_USERNAME;
    const previousPassword = process.env.DEMO_PASSWORD;
    process.env.NODE_ENV = "production";
    delete process.env.DEMO_USERNAME;
    delete process.env.DEMO_PASSWORD;

    try {
      const response = await request(app).get("/api/filters");
      assert.equal(response.status, 503);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousUsername === undefined) delete process.env.DEMO_USERNAME;
      else process.env.DEMO_USERNAME = previousUsername;
      if (previousPassword === undefined) delete process.env.DEMO_PASSWORD;
      else process.env.DEMO_PASSWORD = previousPassword;
    }
  });
});
