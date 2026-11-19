import express from "express"; import cors from "cors"; import { z } from "zod"; import { analytics, filters, getEmployee, listEmployees, updateSalary } from "./service.js";
export const app=express(); app.use(cors()); app.use(express.json());
const query=z.object({search:z.string().optional(),country:z.string().optional(),department:z.string().optional(),sort:z.enum(["name","salary","department","country"]).optional(),direction:z.enum(["asc","desc"]).optional(),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)});
app.get("/api/health",(_,res)=>res.json({ok:true})); app.get("/api/analytics",(_,res)=>res.json(analytics())); app.get("/api/filters",(_,res)=>res.json(filters()));
app.get("/api/employees",(req,res)=>{const p=query.safeParse(req.query);if(!p.success)return res.status(400).json({error:"Invalid query",details:p.error.flatten()});res.json(listEmployees(p.data))});
app.get("/api/employees/:id",(req,res)=>{const e=getEmployee(Number(req.params.id));if(!e)return res.status(404).json({error:"Employee not found"});res.json(e)});
const change=z.object({salaryMinor:z.number().int().min(1).max(100_000_000),reason:z.string().trim().min(3).max(300)});
app.patch("/api/employees/:id/salary",(req,res)=>{const body=change.safeParse(req.body);if(!body.success)return res.status(400).json({error:"Invalid salary change",details:body.error.flatten()});const e=updateSalary(Number(req.params.id),body.data.salaryMinor,body.data.reason);if(!e)return res.status(404).json({error:"Employee not found"});res.json(e)});
