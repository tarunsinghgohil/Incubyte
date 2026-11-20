import express, { type NextFunction, type Request, type Response } from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { requireDemoAccess } from "./access.js";
import {
  analytics,
  filters,
  getEmployee,
  listEmployees,
  parseAnnualSalary,
  updateSalary,
} from "./service.js";

export const app = express();
app.use(requireDemoAccess);
app.use(express.json({ limit: "16kb" }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

const query = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sortBy: z.enum(["name", "employeeCode", "country", "department", "annualSalary", "hireDate", "salary"]).optional(),
  sort: z.enum(["name", "salary", "department", "country"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/dashboard/overview", (_req, res) => res.json(analytics()));
app.get("/api/dashboard/by-country", (_req, res) => res.json(analytics().byCountry));
app.get("/api/dashboard/by-department", (_req, res) => res.json(analytics().byDepartment));
app.get("/api/analytics", (_req, res) => res.json(analytics()));
app.get("/api/metadata/filters", (_req, res) => res.json(filters()));
app.get("/api/filters", (_req, res) => res.json(filters()));

app.get("/api/employees", (req, res) => {
  const parsed = query.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  }
  return res.json(listEmployees(parsed.data));
});

app.get("/api/employees/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: "Employee not found" });
  const employee = getEmployee(id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(employee);
});

app.get("/api/employees/:id/salary-history", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: "Employee not found" });
  const employee = getEmployee(id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(employee.history);
});

const change = z.object({
  annualSalary: z.string().optional(),
  salaryMinor: z.number().int().min(1).max(100_000_000).optional(),
  reason: z.string().trim().min(1).max(500),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((value, context) => {
  if (value.annualSalary === undefined && value.salaryMinor === undefined) {
    context.addIssue({ code: "custom", message: "annualSalary is required.", path: ["annualSalary"] });
  }
});

app.patch("/api/employees/:id/salary", (req, res) => {
  const parsed = change.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted fields.",
        details: parsed.error.flatten().fieldErrors,
      },
    });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Employee not found." } });
  const minor = parsed.data.annualSalary !== undefined
    ? parseAnnualSalary(parsed.data.annualSalary)
    : parsed.data.salaryMinor ?? null;
  if (minor === null) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please correct the highlighted fields.",
        details: { annualSalary: "Enter a valid positive amount with no more than two decimal places." },
      },
    });
  }
  const effectiveDate = parsed.data.effectiveDate ?? new Date().toISOString().slice(0, 10);
  const employee = updateSalary(id, minor, parsed.data.reason, effectiveDate);
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(employee);
});

const webRoot = resolve(process.cwd(), "dist");
if (process.env.NODE_ENV === "production" || existsSync(webRoot)) {
  app.use(express.static(webRoot));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(resolve(webRoot, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "API route not found." },
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError) {
    return res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
    });
  }
  console.error("Unhandled API error", error);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." },
  });
});
