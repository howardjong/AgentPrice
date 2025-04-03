import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { IStorage } from '../../server/storage';
import { db, closeDatabase } from '../../server/db';
import { PgStorage } from '../../server/pg-storage';
import {
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  researchJobs, type ResearchJob, type InsertResearchJob,
  researchReports, type ResearchReport, type InsertResearchReport,
} from '@shared/schema';

/**
 * Database Test Utilities
 * 
 * This file provides utilities for database testing, including:
 * 1. Setting up test databases
 * 2. Creating test data
 * 3. Mocking the database
 * 4. Transaction isolation for tests
 */

// Setup a test database environment
export function setupTestDatabase() {
  let storage: PgStorage;
  
  beforeAll(async () => {
    // Initialize the database
    storage = new PgStorage();
  });
  
  afterAll(async () => {
    // Close the database connection
    await closeDatabase();
  });
  
  // Return a function to get the storage instance
  return {
    getStorage: () => storage
  };
}

// Factory functions to create test data
export const createTestData = {
  // Create a test user
  user: async (storage: IStorage, overrides?: Partial<InsertUser>): Promise<User> => {
    const username = `test-user-${Date.now()}`;
    return await storage.createUser({
      username,
      password: 'password123',
      ...overrides
    });
  },
  
  // Create a test conversation
  conversation: async (storage: IStorage, userId?: number, overrides?: Partial<InsertConversation>): Promise<Conversation> => {
    return await storage.createConversation({
      userId: userId || null,
      title: `Test Conversation ${Date.now()}`,
      ...overrides
    });
  },
  
  // Create a test message
  message: async (storage: IStorage, conversationId: number, overrides?: Partial<InsertMessage>): Promise<Message> => {
    return await storage.createMessage({
      conversationId,
      role: 'user',
      content: 'Test message content',
      service: 'system',
      ...overrides
    });
  },
  
  // Create a test research job
  researchJob: async (storage: IStorage, userId?: number, overrides?: Partial<InsertResearchJob>): Promise<ResearchJob> => {
    return await storage.createResearchJob({
      userId: userId || null,
      query: 'Test research query',
      jobId: `test-job-${Date.now()}`,
      options: null,
      ...overrides
    });
  },
  
  // Create a test research report
  researchReport: async (storage: IStorage, jobId: number, overrides?: Partial<InsertResearchReport>): Promise<ResearchReport> => {
    return await storage.createResearchReport({
      jobId,
      title: 'Test Research Report',
      content: 'Test research report content',
      ...overrides
    });
  }
};

// Create a mock database for unit testing
export function mockDatabase() {
  // Create a mock storage implementation
  const mockStorage: IStorage = {
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    
    getMessage: vi.fn(),
    createMessage: vi.fn(),
    getMessagesByConversation: vi.fn(),
    
    getResearchJob: vi.fn(),
    getResearchJobByBullJobId: vi.fn(),
    createResearchJob: vi.fn(),
    updateResearchJobStatus: vi.fn(),
    updateResearchJobResult: vi.fn(),
    listResearchJobs: vi.fn(),
    
    getResearchReport: vi.fn(),
    createResearchReport: vi.fn(),
    listResearchReports: vi.fn(),
    
    getApiStatus: vi.fn(),
    updateServiceStatus: vi.fn(),
  };
  
  // Reset all mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  return {
    mockStorage
  };
}

// Setup transaction isolation for database tests
export function setupTransactionTest() {
  let client: any; // Postgres client
  
  beforeEach(async () => {
    // Begin a transaction
    client = await db.execute(sql => sql`BEGIN`);
  });
  
  afterEach(async () => {
    // Rollback the transaction after each test
    await db.execute(sql => sql`ROLLBACK`);
  });
  
  return {
    db
  };
}