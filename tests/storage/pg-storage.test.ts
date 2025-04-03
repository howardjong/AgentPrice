import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDatabase, createTestData } from '../utils/db-test-utils';
import type { IStorage } from '../../server/storage';

/**
 * PostgreSQL Storage Integration Tests
 * 
 * These tests verify that the PostgreSQL storage implementation works correctly
 * with a real database. They test all CRUD operations for each entity type.
 */

// Setup test database environment
const { getStorage } = setupTestDatabase();
let storage: IStorage;

// Initialize storage before all tests
beforeAll(() => {
  storage = getStorage();
});

describe('PgStorage - User Operations', () => {
  it('should create and retrieve a user', async () => {
    // Create a user
    const username = `test-user-${Date.now()}`;
    const createdUser = await storage.createUser({
      username,
      password: 'test-password'
    });
    
    // Verify user was created
    expect(createdUser).toBeDefined();
    expect(createdUser.id).toBeDefined();
    expect(createdUser.username).toBe(username);
    
    // Retrieve user by ID
    const retrievedUser = await storage.getUser(createdUser.id);
    expect(retrievedUser).toEqual(createdUser);
    
    // Retrieve user by username
    const userByUsername = await storage.getUserByUsername(username);
    expect(userByUsername).toEqual(createdUser);
  });
  
  it('should return undefined when user does not exist', async () => {
    const nonExistentUser = await storage.getUser(999999);
    expect(nonExistentUser).toBeUndefined();
    
    const nonExistentUserByUsername = await storage.getUserByUsername('non-existent-user');
    expect(nonExistentUserByUsername).toBeUndefined();
  });
});

describe('PgStorage - Conversation Operations', () => {
  it('should create and retrieve a conversation', async () => {
    // Create a user first
    const user = await createTestData.user(storage);
    
    // Create a conversation
    const createdConversation = await storage.createConversation({
      userId: user.id,
      title: 'Test Conversation'
    });
    
    // Verify conversation was created
    expect(createdConversation).toBeDefined();
    expect(createdConversation.id).toBeDefined();
    expect(createdConversation.title).toBe('Test Conversation');
    expect(createdConversation.userId).toBe(user.id);
    expect(createdConversation.createdAt).toBeDefined();
    expect(createdConversation.updatedAt).toBeDefined();
    
    // Retrieve conversation by ID
    const retrievedConversation = await storage.getConversation(createdConversation.id);
    expect(retrievedConversation).toEqual(createdConversation);
  });
  
  it('should list conversations', async () => {
    // Create a user
    const user = await createTestData.user(storage);
    
    // Create conversations
    const conversation1 = await createTestData.conversation(storage, user.id);
    const conversation2 = await createTestData.conversation(storage, user.id);
    
    // List all conversations
    const allConversations = await storage.listConversations();
    expect(allConversations.length).toBeGreaterThanOrEqual(2);
    
    // List conversations for a specific user
    const userConversations = await storage.listConversations(user.id);
    expect(userConversations.length).toBeGreaterThanOrEqual(2);
    expect(userConversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: conversation1.id }),
        expect.objectContaining({ id: conversation2.id })
      ])
    );
  });
});

describe('PgStorage - Message Operations', () => {
  it('should create and retrieve messages', async () => {
    // Create conversation first
    const conversation = await createTestData.conversation(storage);
    
    // Create a message
    const createdMessage = await storage.createMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Hello, world!',
      service: 'system'
    });
    
    // Verify message was created
    expect(createdMessage).toBeDefined();
    expect(createdMessage.id).toBeDefined();
    expect(createdMessage.conversationId).toBe(conversation.id);
    expect(createdMessage.role).toBe('user');
    expect(createdMessage.content).toBe('Hello, world!');
    expect(createdMessage.service).toBe('system');
    expect(createdMessage.timestamp).toBeDefined();
    
    // Retrieve message by ID
    const retrievedMessage = await storage.getMessage(createdMessage.id);
    expect(retrievedMessage).toEqual(createdMessage);
    
    // Create another message
    await storage.createMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Hi there!',
      service: 'claude'
    });
    
    // Get messages by conversation
    const messages = await storage.getMessagesByConversation(conversation.id);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
  });
});

describe('PgStorage - Research Job Operations', () => {
  it('should create and retrieve research jobs', async () => {
    // Create user first
    const user = await createTestData.user(storage);
    
    // Create a research job
    const createdJob = await storage.createResearchJob({
      userId: user.id,
      query: 'Research test query',
      jobId: `job-${Date.now()}`,
      options: { depth: 'medium' }
    });
    
    // Verify job was created
    expect(createdJob).toBeDefined();
    expect(createdJob.id).toBeDefined();
    expect(createdJob.userId).toBe(user.id);
    expect(createdJob.query).toBe('Research test query');
    expect(createdJob.status).toBe('queued');
    expect(createdJob.progress).toBe(0);
    expect(createdJob.options).toEqual({ depth: 'medium' });
    expect(createdJob.startedAt).toBeDefined();
    
    // Retrieve job by ID
    const retrievedJob = await storage.getResearchJob(createdJob.id);
    expect(retrievedJob).toEqual(createdJob);
    
    // Retrieve job by Bull job ID
    const jobByBullId = await storage.getResearchJobByBullJobId(createdJob.jobId);
    expect(jobByBullId).toEqual(createdJob);
    
    // Update job status
    const updatedJob = await storage.updateResearchJobStatus(createdJob.id, 'processing', 50);
    expect(updatedJob.status).toBe('processing');
    expect(updatedJob.progress).toBe(50);
    
    // Update job result
    const completedJob = await storage.updateResearchJobResult(createdJob.id, { summary: 'Test results' });
    expect(completedJob.status).toBe('completed');
    expect(completedJob.progress).toBe(100);
    expect(completedJob.result).toEqual({ summary: 'Test results' });
    expect(completedJob.completedAt).toBeDefined();
    
    // List jobs for user
    const userJobs = await storage.listResearchJobs(user.id);
    expect(userJobs.length).toBeGreaterThanOrEqual(1);
    expect(userJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdJob.id })
      ])
    );
  });
});

describe('PgStorage - Research Report Operations', () => {
  it('should create and retrieve research reports', async () => {
    // Create a research job first
    const job = await createTestData.researchJob(storage);
    
    // Create a research report
    const createdReport = await storage.createResearchReport({
      jobId: job.id,
      title: 'Test Report',
      content: 'Test report content',
      summary: 'Test summary',
      citations: [{ source: 'Test source', text: 'Test citation' }],
      followUpQuestions: ['Question 1', 'Question 2'],
      filePath: '/test/path.pdf'
    });
    
    // Verify report was created
    expect(createdReport).toBeDefined();
    expect(createdReport.id).toBeDefined();
    expect(createdReport.jobId).toBe(job.id);
    expect(createdReport.title).toBe('Test Report');
    expect(createdReport.content).toBe('Test report content');
    expect(createdReport.summary).toBe('Test summary');
    expect(createdReport.citations).toEqual([{ source: 'Test source', text: 'Test citation' }]);
    expect(createdReport.followUpQuestions).toEqual(['Question 1', 'Question 2']);
    expect(createdReport.filePath).toBe('/test/path.pdf');
    expect(createdReport.createdAt).toBeDefined();
    
    // Retrieve report by ID
    const retrievedReport = await storage.getResearchReport(createdReport.id);
    expect(retrievedReport).toEqual(createdReport);
    
    // Create another report for the same job
    await storage.createResearchReport({
      jobId: job.id,
      title: 'Second Test Report',
      content: 'Second test report content',
    });
    
    // List reports by job ID
    const jobReports = await storage.listResearchReports(job.id);
    expect(jobReports.length).toBe(2);
    expect(jobReports[0].title).toBe('Test Report');
    expect(jobReports[1].title).toBe('Second Test Report');
  });
});

describe('PgStorage - API Status Operations', () => {
  it('should get and update API status', async () => {
    // Get API status
    const status = await storage.getApiStatus();
    
    // Verify status structure
    expect(status).toBeDefined();
    expect(status.claude).toBeDefined();
    expect(status.perplexity).toBeDefined();
    expect(status.server).toBeDefined();
    
    // Update service status
    await storage.updateServiceStatus('claude', {
      status: 'disconnected',
      lastUsed: new Date().toISOString()
    });
    
    // Get updated status
    const updatedStatus = await storage.getApiStatus();
    expect(updatedStatus.claude.status).toBe('disconnected');
  });
});