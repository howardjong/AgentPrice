/**
 * Database Safety Checks
 * 
 * This module provides safety utilities to prevent accidental modifications
 * to production databases during testing.
 */

/**
 * Verifies that a database connection string refers to a test database
 * @param {string} connectionString - The database connection string
 * @throws {Error} If the connection string doesn't appear to be for a test database
 */
export function verifyTestDatabase(connectionString) {
  // Skip check if explicitly disabled (use with caution!)
  if (process.env.SKIP_DB_SAFETY_CHECKS === 'true') {
    console.warn('⚠️ Database safety checks are disabled. Use with caution!');
    return;
  }

  if (!connectionString) {
    throw new Error('Missing database connection string');
  }

  // Check if this is a test database
  const testIndicators = ['test', 'dev', 'development', 'vitest'];
  const isTestDatabase = testIndicators.some(indicator => 
    connectionString.toLowerCase().includes(indicator)
  );

  if (!isTestDatabase) {
    throw new Error(
      'Safety check failed: Operation attempted on a non-test database.\n' +
      'To ensure safety, database operations in tests should only run against ' +
      'databases containing "test", "dev", or "development" in their connection string.'
    );
  }
}

/**
 * Verifies that a SQL statement is safe to run in tests
 * @param {string} sql - The SQL statement to check
 * @param {boolean} allowDestructive - Whether to allow destructive operations (default: false)
 * @throws {Error} If the statement contains potentially unsafe operations
 */
export function verifySafeSql(sql, allowDestructive = false) {
  // Skip check if explicitly disabled (use with caution!)
  if (process.env.SKIP_DB_SAFETY_CHECKS === 'true') {
    return;
  }

  // Destructive operations to check for
  const destructivePatterns = [
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /TRUNCATE\s+TABLE/i,
    /DELETE\s+FROM(?!\s+.+\s+WHERE)/i, // DELETE without WHERE clause
  ];

  // Only check for destructive operations if they're not explicitly allowed
  if (!allowDestructive) {
    for (const pattern of destructivePatterns) {
      if (pattern.test(sql)) {
        throw new Error(
          `Safety check failed: Potentially destructive SQL operation detected: ${sql}\n` +
          'To run this statement, set allowDestructive=true explicitly, ' + 
          'and ensure it only targets test data.'
        );
      }
    }
  }
}

/**
 * Creates a safe database client wrapper with built-in safety checks
 * @param {Object} client - The database client to wrap
 * @param {Object} options - Configuration options
 * @param {boolean} options.isTestDatabase - Whether this is a test database
 * @param {boolean} options.allowDestructive - Whether to allow destructive operations
 * @returns {Object} A wrapped client with safety checks
 */
export function createSafeDbClient(client, { isTestDatabase = false, allowDestructive = false } = {}) {
  // Skip wrapping if safety checks are disabled
  if (process.env.SKIP_DB_SAFETY_CHECKS === 'true') {
    return client;
  }

  // Create a proxy to intercept query calls
  return new Proxy(client, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      
      // Intercept the query method
      if (prop === 'query' && typeof original === 'function') {
        return function(...args) {
          const sql = args[0];
          
          // Verify this is a test database if required
          if (!isTestDatabase) {
            if (target.connectionString) {
              verifyTestDatabase(target.connectionString);
            } else if (process.env.DATABASE_URL) {
              verifyTestDatabase(process.env.DATABASE_URL);
            } else {
              throw new Error('Unable to verify database type - no connection string available');
            }
          }
          
          // Check if the SQL is safe
          verifySafeSql(sql, allowDestructive);
          
          // Call the original method
          return original.apply(target, args);
        };
      }
      
      return original;
    }
  });
}

/**
 * Wraps a database connection pool with safety checks
 * @param {Object} pool - The database connection pool to wrap
 * @returns {Object} A wrapped pool with safety checks
 */
export function createSafeDbPool(pool) {
  // Create a safe version of the pool
  const safePool = createSafeDbClient(pool);
  
  // Also ensure connect() returns safe clients
  const originalConnect = pool.connect;
  safePool.connect = async function(...args) {
    const client = await originalConnect.apply(pool, args);
    return createSafeDbClient(client);
  };
  
  return safePool;
}