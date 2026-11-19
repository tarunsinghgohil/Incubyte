import express from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { requireDemoAccess } from "./access.js";
import { analytics, filters, getEmployee, listEmployees, updateSalary } from "./service.js";

export const app = express();
app.use(requireDemoAccess);
app.use(express.json({ limit: "16kb" }));

const query = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  department: z.string().optional(),
  sort: z.enum(["name", "salary", "department", "country"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/analytics", (_req, res) => res.json(analytics()));
app.get("/api/filters", (_req, res) => res.json(filters()));

app.get("/api/employees", (req, res) => {
  const parsed = query.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  }
  return res.json(listEmployees(parsed.data));
});

app.get("/api/employees/:id", (req, res) => {
  const employee = getEmployee(Number(req.params.id));
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(employee);
});

const change = z.object({
  salaryMinor: z.number().int().min(1).max(100_000_000),
  reason: z.string().trim().min(3).max(300),
});

app.patch("/api/employees/:id/salary", (req, res) => {
  const parsed = change.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid salary change", details: parsed.error.flatten() });
  }
  const employee = updateSalary(Number(req.params.id), parsed.data.salaryMinor, parsed.data.reason);
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  return res.json(employee);
});

if (process.env.NODE_ENV === "production") {
  const webRoot = resolve(process.cwd(), "dist");
  app.use(express.static(webRoot));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(resolve(webRoot, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}
