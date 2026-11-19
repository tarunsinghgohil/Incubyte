import { initialize } from "./db.js"; import { app } from "./app.js"; initialize(); app.listen(3001,()=>console.log("API listening on http://localhost:3001"));
