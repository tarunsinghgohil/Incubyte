import { db, initialize } from "./db.js";
initialize(); db.exec("DELETE FROM salary_changes; DELETE FROM employees;");
const countries=[ ["United States","USD",8500000],["India","INR",2800000],["United Kingdom","GBP",6200000],["Germany","EUR",6800000],["Singapore","SGD",7200000],["Australia","AUD",7000000] ] as const;
const departments=["Engineering","Product","Sales","Marketing","People","Finance","Operations"];
const first=["Aarav","Olivia","Noah","Emma","Liam","Sophia","Ishaan","Mia","Lucas","Ava"];
const last=["Sharma","Williams","Brown","Taylor","Patel","Wilson","Miller","Davis","Khan","Anderson"];
const insert=db.prepare("INSERT INTO employees(employee_code,first_name,last_name,email,department,country,currency,salary_minor,job_title,start_date,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
const seedTimestamp="2024-01-01T00:00:00.000Z";
const write=db.transaction(()=>{for(let i=1;i<=10000;i++){const [country,currency,base]=countries[i%countries.length];const f=first[i%first.length],l=last[(i*7)%last.length];const department=departments[i%departments.length];const salary=base+((i*7919)%4500000);insert.run(`ACME-${String(i).padStart(5,"0")}`,f,l,`${f.toLowerCase()}.${l.toLowerCase()}${i}@acme.test`,department,country,currency,salary, i%5===0?"Senior Manager":i%3===0?"Specialist":"Associate",`20${18+i%7}-${String(1+i%12).padStart(2,"0")}-15`,seedTimestamp)}});write(); console.log("Seeded 10,000 employees.");
