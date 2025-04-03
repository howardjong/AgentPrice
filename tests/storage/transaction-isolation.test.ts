import { describe, it, expect } from 'vitest';
import { setupTransactionTest } from '../utils/db-test-utils';
import { pgStorage } from '../../server/pg-storage';
import {
  users, conversations, messages
} from '@shared/schema';

/**
 * Transaction Isolation Tests
 * 
 * These tests demonstrate how to use transaction isolation to run database tests
 * without contaminating the database across test runs. Each test runs in a
 * transaction that is rolled back at the end.
 */

describe('Transaction Isolation', () => {
  // Setup transaction test environment
  const { db } = setupTransactionTest();
  const storage = pgStorage;
  
  it('should be able to create and retrieve a user in a transaction', async () => {
    // Create a user directly with Drizzle
    const userInsert = await db.insert(users).values({
      username: 'transaction-test-user',
      password: 'password123'
    }).returning();
    
    // Verify user was inserted
    expect(userInsert.length).toBe(1);
    const userId = userInsert[0].id;
    
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
  
  it('should be able to test storage error cases', async () => {
    // Try to get a conversation that doesn't exist
    const conversation = await storage.getConversation(999999);
    expect(conversation).toBeUndefined();
    
    // Try to get a user that doesn't exist
    const user = await storage.getUser(999999);
    expect(user).toBeUndefined();
    
    // Try to update a research job that doesn't exist
    await expect(storage.updateResearchJobStatus(999999, 'completed'))
      .rejects.toThrow();
  });
});