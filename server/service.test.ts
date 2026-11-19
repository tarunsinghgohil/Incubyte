import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db, initialize } from "./db.js";
import { analytics, listEmployees, updateSalary } from "./service.js";

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
    "Ada",
    "Lovelace",
    "ada@acme.test",
    "Engineering",
    "India",
    "INR",
    100_000,
    "Engineer",
    "2024-01-01",
    "2024-01-01",
  );
});

describe("salary service", () => {
  it("filters and pages employees", () => {
    const result = listEmployees({
      country: "India",
      page: 1,
      pageSize: 10,
      sort: "salary",
      direction: "desc",
    });
    assert.equal(result.meta.total, 1);
    assert.equal(result.data[0].name, "Ada Lovelace");
  });

  it("sorts the directory by first name", () => {
    db.prepare(`
      INSERT INTO employees(
        employee_code,first_name,last_name,email,department,country,currency,
        salary_minor,job_title,start_date,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      "ACME-2",
      "Grace",
      "Hopper",
      "grace@acme.test",
      "Sales",
      "India",
      "INR",
      200_000,
      "Director",
      "2020-01-01",
      "2024-01-01",
    );
    const result = listEmployees({ page: 1, pageSize: 10, sort: "name", direction: "asc" });
    assert.deepEqual(result.data.map((employee) => employee.name), ["Ada Lovelace", "Grace Hopper"]);
  });

  it("aggregates compensation by country and department", () => {
    db.prepare(`
      INSERT INTO employees(
        employee_code,first_name,last_name,email,department,country,currency,
        salary_minor,job_title,start_date,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      "ACME-2",
      "Grace",
      "Hopper",
      "grace@acme.test",
      "Sales",
      "India",
      "INR",
      200_000,
      "Director",
      "2020-01-01",
      "2024-01-01",
    );

    const result = analytics();
    assert.equal(result.payrollUsd, 36);
    assert.deepEqual(result.byCountry, [
      { country: "India", headcount: 2, payrollUsd: 36, averageUsd: 18 },
    ]);
    assert.deepEqual(result.byDepartment, [
      { department: "Engineering", headcount: 1, payrollUsd: 12, averageUsd: 12 },
      { department: "Sales", headcount: 1, payrollUsd: 24, averageUsd: 24 },
    ]);
  });

  it("returns zero-valued compensation metrics for an empty organization", () => {
    db.exec("DELETE FROM employees");
    const result = analytics();
    assert.equal(result.headcount, 0);
    assert.equal(result.averageUsd, 0);
    assert.equal(result.medianUsd, 0);
    assert.deepEqual(result.byCountry, []);
    assert.deepEqual(result.byDepartment, []);
  });

  it("records an immutable salary history when updating", () => {
    const updated = updateSalary(1, 125_000, "Annual merit increase")!;
    assert.equal(updated.salary_minor, 125_000);
    assert.equal(updated.history.length, 1);
    assert.partialDeepStrictEqual(updated.history[0], {
      old_salary_minor: 100_000,
      new_salary_minor: 125_000,
      reason: "Annual merit increase",
    });
  });
});
