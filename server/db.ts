import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import logger from "@utils/logger";

/**
 * Database Connection
 * 
 * This file handles the PostgreSQL database connection using Drizzle ORM.
 * It exports the database client for use throughout the application.
 */

// Check if DATABASE_URL is set in the environment
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is not set!');
  throw new Error('DATABASE_URL environment variable is required');
}

// Get database connection string from environment
const connectionString = process.env.DATABASE_URL;

// Create the PostgreSQL client
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 30, // Max idle time in seconds
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Disable auto-prepared statements for better compatibility
});

/**
 * Initialize the database connection
 * This logs any connection issues but doesn't throw to allow the app to start
 * even if the database is temporarily unavailable
 */
export async function initializeDatabase() {
  try {
    // Simple query to check connection
    await client`SELECT NOW()`;
    logger.info("Successfully connected to PostgreSQL database");
    return true;
  } catch (error) {
    logger.error("Failed to connect to PostgreSQL database", { error });
    return false;
  }
}

// Create a Drizzle database instance with the schema
export const db = drizzle(client, { schema });

// Export a function to get a client for transaction usage
export function getClient() {
  return client;
}

// Create helper to check if database is available
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    logger.error("Database availability check failed", { error });
    return false;
  }
}

// Helper for closing the database connection
export async function closeDatabase() {
  try {
    await client.end();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error("Error closing database connection", { error });
  }
}