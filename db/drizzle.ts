import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/neon-http';

config({ path: ".env" }); // or .env.local

// Create database client with proper error handling
function createDatabaseClient() {
  if (!process.env.DATABASE_URL) {
    // During build time or when DATABASE_URL is missing, return a mock client
    // This prevents the build from failing while still providing helpful error messages
    console.warn("DATABASE_URL environment variable is missing. Database operations will be disabled.");
    return null;
  }
  
  return drizzle(process.env.DATABASE_URL);
}

export const db = createDatabaseClient();
