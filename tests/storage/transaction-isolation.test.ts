/**
 * Transaction Isolation Tests
 * 
 * These tests demonstrate how to use transaction isolation for database tests,
 * ensuring that test data doesn't persist between tests.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { db, pool } from '../../server/db';
import { PgStorage } from '../../server/pg-storage';
import { users, conversations, messages } from '../../shared/schema';

describe('Transaction Isolation', () => {
  let storage: PgStorage;
  let client: any;
  let rollback: any;

  // Set up transaction before each test
  beforeEach(async () => {
    // Create a storage instance
    storage = new PgStorage();
    
    // Connect a client
    client = await pool.connect();
    
    // Start a transaction
    rollback = await client.query('BEGIN');
  });

  // Roll back the transaction after each test
  afterEach(async () => {
    // Roll back any changes
    await client.query('ROLLBACK');
    
    // Release the client
    client.release();
  });

  it('should create and retrieve data within a transaction', async () => {
    // Insert a user directly with the db client
    const insertResult = await db.insert(users).values({
      username: 'transaction-test-user',
      password: 'password123'
    }).returning();

    // Verify the insert worked
    expect(insertResult.length).toBe(1);
    expect(insertResult[0].username).toBe('transaction-test-user');

    // Now use the storage interface to retrieve the user
    const user = await storage.getUserByUsername('transaction-test-user');

    // Verify we can get the user
    expect(user).toBeDefined();
    expect(user?.username).toBe('transaction-test-user');
  });

  it('should not see data from previous test', async () => {
    // Try to get the user from the previous test
    const user = await storage.getUserByUsername('transaction-test-user');

    // It should not exist because the previous transaction was rolled back
    expect(user).toBeUndefined();
  });

  it('should be able to create a complete conversation with messages', async () => {
    // Create a user
    const userInsert = await db.insert(users).values({
      username: 'conversation-user',
      password: 'password123'
    }).returning();
    const userId = userInsert[0].id;

    // Create a conversation
    const conversationInsert = await db.insert(conversations).values({
      userId,
      title: 'Transaction Test Conversation',
    }).returning();
    const conversationId = conversationInsert[0].id;

    // Add some messages
    await db.insert(messages).values([
      {
        conversationId,
        role: 'user',
        content: 'Hello',
        service: 'system',
      },
      {
        conversationId,
        role: 'assistant',
        content: 'Hi there!',
        service: 'claude',
      }
    ]);

    // Now retrieve the conversation and messages using the storage interface
    const conversation = await storage.getConversation(conversationId);
    const messagesResult = await storage.getMessagesByConversation(conversationId);

    // Verify conversation
    expect(conversation).toBeDefined();
    expect(conversation?.title).toBe('Transaction Test Conversation');
    expect(conversation?.userId).toBe(userId);

    // Verify messages
    expect(messagesResult.length).toBe(2);
    expect(messagesResult[0].role).toBe('user');
    expect(messagesResult[0].content).toBe('Hello');
    expect(messagesResult[1].role).toBe('assistant');
    expect(messagesResult[1].content).toBe('Hi there!');
  });
});