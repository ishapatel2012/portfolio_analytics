import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL as string;
console.log(DATABASE_URL, "########################");
import dotenv from "dotenv";
dotenv.config();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});
