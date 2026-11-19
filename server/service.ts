import { db } from "./db.js";
import type { Employee } from "./types.js";
import { toUsd } from "./types.js";

type Query = { search?:string; country?:string; department?:string; sort?:string; direction?:string; page:number; pageSize:number };
const columns: Record<string,string> = { name:"last_name", salary:"salary_minor", department:"department", country:"country" };
export function listEmployees(q:Query) {
  const clauses:string[]=[]; const args:unknown[]=[];
  if(q.search){ clauses.push("(employee_code LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)"); const v=`%${q.search}%`; args.push(v,v,v,v); }
  if(q.country){clauses.push("country = ?");args.push(q.country)}
  if(q.department){clauses.push("department = ?");args.push(q.department)}
  const where=clauses.length?`WHERE ${clauses.join(" AND ")}`:"";
  const total=(db.prepare(`SELECT COUNT(*) count FROM employees ${where}`).get(...args) as {count:number}).count;
  const column=columns[q.sort ?? "salary"] ?? "salary_minor"; const direction=q.direction === "asc" ? "ASC":"DESC";
  const rows=db.prepare(`SELECT * FROM employees ${where} ORDER BY ${column} ${direction}, id ASC LIMIT ? OFFSET ?`).all(...args,q.pageSize,(q.page-1)*q.pageSize) as Employee[];
  return { data:rows.map(present), meta:{ total, page:q.page, pageSize:q.pageSize, pages:Math.max(1,Math.ceil(total/q.pageSize)) } };
}
export function present(employee:Employee){ return {...employee, name:`${employee.first_name} ${employee.last_name}`, salary_usd:toUsd(employee.salary_minor,employee.currency)} }
export function getEmployee(id:number) { const e=db.prepare("SELECT * FROM employees WHERE id=?").get(id) as Employee|undefined; if(!e)return null; const history=db.prepare("SELECT * FROM salary_changes WHERE employee_id=? ORDER BY changed_at DESC").all(id); return {...present(e),history}; }
export function updateSalary(id:number,newSalary:number,reason:string) {
  const change=db.transaction(()=>{ const employee=db.prepare("SELECT * FROM employees WHERE id=?").get(id) as Employee|undefined; if(!employee)return null; const now=new Date().toISOString(); db.prepare("UPDATE employees SET salary_minor=?, updated_at=? WHERE id=?").run(newSalary,now,id); db.prepare("INSERT INTO salary_changes(employee_id,old_salary_minor,new_salary_minor,reason,changed_at) VALUES(?,?,?,?,?)").run(id,employee.salary_minor,newSalary,reason,now); return getEmployee(id); }); return change();
}
export function filters(){ return { countries:db.prepare("SELECT DISTINCT country FROM employees ORDER BY country").all().map((x:any)=>x.country), departments:db.prepare("SELECT DISTINCT department FROM employees ORDER BY department").all().map((x:any)=>x.department) }; }
export function analytics(){ const all=db.prepare("SELECT salary_minor,currency FROM employees").all() as Pick<Employee,"salary_minor"|"currency">[]; const usd=all.map(x=>toUsd(x.salary_minor,x.currency)).sort((a,b)=>a-b); const sum=usd.reduce((a,b)=>a+b,0); const groups=db.prepare("SELECT country, COUNT(*) headcount FROM employees GROUP BY country ORDER BY headcount DESC").all(); return { headcount:all.length, payrollUsd:Math.round(sum), averageUsd:Math.round(sum/all.length), medianUsd:usd.length%2?usd[(usd.length-1)/2]:Math.round((usd[usd.length/2-1]+usd[usd.length/2])/2), byCountry:groups }; }
