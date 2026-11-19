export type Employee = { id:number; employee_code:string; first_name:string; last_name:string; email:string; department:string; country:string; currency:string; salary_minor:number; job_title:string; start_date:string; updated_at:string };
export const fxRates: Record<string, number> = { USD: 1, INR: 0.012, GBP: 1.31, EUR: 1.09, SGD: 0.74, AUD: 0.66 };
export const toUsd = (minor:number, currency:string) => Math.round((minor / 100) * (fxRates[currency] ?? 1) * 100) / 100;
