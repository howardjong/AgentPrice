/**
 * Database testing utilities
 * This file contains utility functions to help with database testing
 */
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db, resetDatabase, closeDatabaseConnections } from '../../server/db';
import { PgStorage } from '../../server/pg-storage';
import type { IStorage } from '../../server/storage';
import { 
  type User, type InsertUser,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type ResearchJob, type InsertResearchJob,
  type ResearchReport, type InsertResearchReport
} from '../../shared/schema';

/**
 * Helper function to initialize the database for testing
 * @returns A setup object with the db client and storage implementation
 */
export function setupTestDatabase() {
  let storage: IStorage;

  // Setup before all tests
  beforeAll(async () => {
    // Ensure we're in a test environment
    process.env.NODE_ENV = 'test';
    
    // Reset the database to a clean state
    await resetDatabase();
    
    // Create a new storage instance
    storage = new PgStorage();
  });

  // Clean up after all tests
  afterAll(async () => {
    await closeDatabaseConnections();
  });

  // Reset the database before each test
  beforeEach(async () => {
    await resetDatabase();
  });

  return {
    db,
    getStorage: () => storage,
  };
}

/**
 * Helper function to create test data
 */
export const createTestData = {
  /**
   * Create a test user
   * @param overrides Optional overrides for the user data
   * @returns The created user
   */
  async user(storage: IStorage, overrides: Partial<InsertUser> = {}): Promise<User> {
    const username = overrides.username || `test-user-${Date.now()}`;
    const password = overrides.password || 'test-password';
    
    return await storage.createUser({
      username,
      password,
      ...overrides,
    });
  },

  /**
   * Create a test conversation
   * @param storage The storage implementation
   * @param userId Optional user ID
   * @param overrides Optional overrides for the conversation data
   * @returns The created conversation
   */
  async conversation(
    storage: IStorage, 
    userId?: number, 
    overrides: Partial<InsertConversation> = {}
  ): Promise<Conversation> {
    return await storage.createConversation({
      userId: userId ?? null,
      title: `Test Conversation ${Date.now()}`,
      ...overrides,
    });
  },

  /**
   * Create a test message
   * @param storage The storage implementation
   * @param conversationId The conversation ID
   * @param overrides Optional overrides for the message data
   * @returns The created message
   */
  async message(
    storage: IStorage,
    conversationId: number,
    overrides: Partial<InsertMessage> = {}
  ): Promise<Message> {
    return await storage.createMessage({
      conversationId,
      role: overrides.role || 'user',
      content: overrides.content || `Test message ${Date.now()}`,
      service: overrides.service || 'system',
      ...overrides,
    });
  },

  /**
   * Create a test research job
   * @param storage The storage implementation
   * @param userId Optional user ID
   * @param overrides Optional overrides for the research job data
   * @returns The created research job
   */
  async researchJob(
    storage: IStorage,
    userId?: number,
    overrides: Partial<InsertResearchJob> = {}
  ): Promise<ResearchJob> {
    return await storage.createResearchJob({
      userId: userId ?? null,
      query: overrides.query || `Test research query ${Date.now()}`,
      jobId: overrides.jobId || `job-${Date.now()}`,
      options: overrides.options || { depth: 'medium' },
      ...overrides,
    });
  },

  /**
   * Create a test research report
   * @param storage The storage implementation
   * @param jobId The research job ID
   * @param overrides Optional overrides for the research report data
   * @returns The created research report
   */
  async researchReport(
    storage: IStorage,
    jobId: number,
    overrides: Partial<InsertResearchReport> = {}
  ): Promise<ResearchReport> {
    return await storage.createResearchReport({
      jobId,
      title: overrides.title || `Test Report ${Date.now()}`,
      content: overrides.content || 'This is test report content.',
      summary: overrides.summary || 'Test summary',
      citations: overrides.citations || [{ title: 'Test Source', url: 'https://example.com' }],
      followUpQuestions: overrides.followUpQuestions || ['Question 1?', 'Question 2?'],
      filePath: overrides.filePath || null,
      ...overrides,
    });
  },
};

/**
 * Helper function to mock the database for unit tests
 * This creates a mock PgStorage implementation
 */
export function mockDatabase() {
  // Create a mock store that mimics the storage interface
  const mockStore = {
    users: new Map<number, User>(),
    conversations: new Map<number, Conversation>(),
    messages: new Map<number, Message>(),
    researchJobs: new Map<number, ResearchJob>(),
    researchReports: new Map<number, ResearchReport>(),
    counters: {
      userId: 1,
      conversationId: 1,
      messageId: 1,
      researchJobId: 1,
      researchReportId: 1,
    },
  };

  // Create mock implementations for all storage methods
  const mockStorage: IStorage = {
    // User methods
    getUser: vi.fn().mockImplementation(async (id: number) => mockStore.users.get(id)),
    getUserByUsername: vi.fn().mockImplementation(async (username: string) => {
      return Array.from(mockStore.users.values()).find(
        (user) => user.username === username
      );
    }),
    createUser: vi.fn().mockImplementation(async (user: InsertUser) => {
      const id = mockStore.counters.userId++;
      const newUser = { ...user, id };
      mockStore.users.set(id, newUser);
      return newUser;
    }),

    // Conversation methods
    getConversation: vi.fn().mockImplementation(async (id: number) => 
      mockStore.conversations.get(id)),
    createConversation: vi.fn().mockImplementation(async (conversation: InsertConversation) => {
      const id = mockStore.counters.conversationId++;
      const now = new Date();
      const newConversation = {
        ...conversation,
        id,
        userId: conversation.userId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      mockStore.conversations.set(id, newConversation);
      return newConversation;
    }),
    listConversations: vi.fn().mockImplementation(async (userId?: number) => {
      const allConversations = Array.from(mockStore.conversations.values());
      if (userId) {
        return allConversations.filter(conv => conv.userId === userId);
      }
      return allConversations;
    }),

    // Message methods
    getMessage: vi.fn().mockImplementation(async (id: number) => mockStore.messages.get(id)),
    createMessage: vi.fn().mockImplementation(async (message: InsertMessage) => {
      const id = mockStore.counters.messageId++;
      const now = new Date();
      const newMessage = {
        id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        service: message.service,
        visualizationData: message.visualizationData ?? null,
        citations: message.citations ?? null,
        timestamp: now,
      } as Message;
      mockStore.messages.set(id, newMessage);
      return newMessage;
    }),
    getMessagesByConversation: vi.fn().mockImplementation(async (conversationId: number) => {
      return Array.from(mockStore.messages.values())
        .filter(msg => msg.conversationId === conversationId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }),

    // Research Job methods
    getResearchJob: vi.fn().mockImplementation(async (id: number) => 
      mockStore.researchJobs.get(id)),
    getResearchJobByBullJobId: vi.fn().mockImplementation(async (jobId: string) => {
      return Array.from(mockStore.researchJobs.values()).find(
        (job) => job.jobId === jobId
      );
    }),
    createResearchJob: vi.fn().mockImplementation(async (job: InsertResearchJob) => {
      const id = mockStore.counters.researchJobId++;
      const now = new Date();
      const newJob = {
        id,
        userId: job.userId ?? null,
        query: job.query,
        status: 'queued',
        progress: 0,
        jobId: job.jobId,
        options: job.options ?? null,
        result: null,
        error: null,
        startedAt: now,
        completedAt: null,
      } as ResearchJob;
      mockStore.researchJobs.set(id, newJob);
      return newJob;
    }),
    updateResearchJobStatus: vi.fn().mockImplementation(async (id: number, status: string, progress?: number) => {
      const job = mockStore.researchJobs.get(id);
      if (!job) {
        throw new Error(`Research job with ID ${id} not found`);
      }
      
      const updatedJob = { ...job, status };
      
      if (progress !== undefined) {
        updatedJob.progress = progress;
      }
      
      if (status === 'completed' || status === 'failed') {
        updatedJob.completedAt = new Date();
      }
      
      mockStore.researchJobs.set(id, updatedJob);
      return updatedJob;
    }),
    updateResearchJobResult: vi.fn().mockImplementation(async (id: number, result: any) => {
      const job = mockStore.researchJobs.get(id);
      if (!job) {
        throw new Error(`Research job with ID ${id} not found`);
      }
      
      const updatedJob = {
        ...job,
        result,
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      };
      
      mockStore.researchJobs.set(id, updatedJob);
      return updatedJob;
    }),
    listResearchJobs: vi.fn().mockImplementation(async (userId?: number) => {
      const allJobs = Array.from(mockStore.researchJobs.values());
      if (userId) {
        return allJobs.filter(job => job.userId === userId);
      }
      return allJobs;
    }),

    // Research Report methods
    getResearchReport: vi.fn().mockImplementation(async (id: number) => 
      mockStore.researchReports.get(id)),
    createResearchReport: vi.fn().mockImplementation(async (report: InsertResearchReport) => {
      const id = mockStore.counters.researchReportId++;
      const now = new Date();
      
      const newReport = {
        id,
        jobId: report.jobId,
        title: report.title,
        content: report.content,
        summary: report.summary ?? null,
        citations: report.citations ?? null,
        followUpQuestions: report.followUpQuestions ?? null,
        filePath: report.filePath ?? null,
        createdAt: now,
      } as ResearchReport;
      
      mockStore.researchReports.set(id, newReport);
      return newReport;
    }),
    listResearchReports: vi.fn().mockImplementation(async (jobId?: number) => {
      const allReports = Array.from(mockStore.researchReports.values());
      if (jobId) {
        return allReports.filter(report => report.jobId === jobId);
      }
      return allReports;
    }),

    // API Status methods
    getApiStatus: vi.fn().mockResolvedValue({
      claude: {
        service: 'Claude API',
        status: 'connected',
        lastUsed: null,
        version: 'Claude 3 Opus',
      },
      perplexity: {
        service: 'Perplexity API',
        status: 'connected',
        lastUsed: null,
        version: 'sonar',
      },
      server: {
        status: 'running',
        load: 23,
        uptime: '1d 0h 0m',
      }
    }),
    updateServiceStatus: vi.fn(),
  };

  return {
    mockStorage,
    mockStore,
  };
}

/**
 * Helper function to create a transaction isolation for tests
 * This ensures each test runs in its own transaction that is rolled back after the test
 */
export function setupTransactionTest() {
  let client: any;
  let rollback: any;

  beforeEach(async () => {
    // Create a client and start a transaction
    client = await db.getClient();
    rollback = await client.query('BEGIN');
  });

  afterEach(async () => {
    // Roll back the transaction after each test
    await client.query('ROLLBACK');
    client.release();
  });
}