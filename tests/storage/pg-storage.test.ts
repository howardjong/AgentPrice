/**
 * PostgreSQL Storage Implementation Tests
 * These tests ensure our PgStorage implementation works correctly with the database
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { setupTestDatabase, createTestData } from '../utils/db-test-utils';
import type { IStorage } from '../../server/storage';

describe('PgStorage Tests', () => {
  // Set up the database and get a storage implementation
  const { getStorage } = setupTestDatabase();
  let storage: IStorage;

  beforeAll(() => {
    storage = getStorage();
  });

  // User tests
  describe('User Operations', () => {
    it('should create a user', async () => {
      // Create a new user
      const user = await createTestData.user(storage, {
        username: 'testuser',
        password: 'password123'
      });

      // Verify the user was created
      expect(user).toBeDefined();
      expect(user.id).toBeGreaterThan(0);
      expect(user.username).toBe('testuser');
      expect(user.password).toBe('password123');
    });

    it('should get a user by ID', async () => {
      // Create a user
      const createdUser = await createTestData.user(storage);
      
      // Get the user by ID
      const user = await storage.getUser(createdUser.id);
      
      // Verify the user
      expect(user).toBeDefined();
      expect(user?.id).toBe(createdUser.id);
      expect(user?.username).toBe(createdUser.username);
    });

    it('should get a user by username', async () => {
      // Create a unique username
      const uniqueUsername = `unique-user-${Date.now()}`;
      
      // Create a user
      await createTestData.user(storage, { username: uniqueUsername });
      
      // Get the user by username
      const user = await storage.getUserByUsername(uniqueUsername);
      
      // Verify the user
      expect(user).toBeDefined();
      expect(user?.username).toBe(uniqueUsername);
    });

    it('should return undefined for non-existent user', async () => {
      // Try to get a user with an invalid ID
      const user = await storage.getUser(99999);
      
      // Verify no user was found
      expect(user).toBeUndefined();
    });
  });

  // Conversation tests
  describe('Conversation Operations', () => {
    it('should create a conversation', async () => {
      // Create a user
      const user = await createTestData.user(storage);
      
      // Create a conversation for that user
      const conversation = await createTestData.conversation(storage, user.id, {
        title: 'Test Conversation'
      });
      
      // Verify the conversation
      expect(conversation).toBeDefined();
      expect(conversation.id).toBeGreaterThan(0);
      expect(conversation.userId).toBe(user.id);
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.createdAt).toBeInstanceOf(Date);
      expect(conversation.updatedAt).toBeInstanceOf(Date);
    });

    it('should get a conversation by ID', async () => {
      // Create a conversation
      const createdConversation = await createTestData.conversation(storage);
      
      // Get the conversation by ID
      const conversation = await storage.getConversation(createdConversation.id);
      
      // Verify the conversation
      expect(conversation).toBeDefined();
      expect(conversation?.id).toBe(createdConversation.id);
      expect(conversation?.title).toBe(createdConversation.title);
    });

    it('should list all conversations', async () => {
      // Create a few conversations
      await createTestData.conversation(storage, null, { title: 'Conversation 1' });
      await createTestData.conversation(storage, null, { title: 'Conversation 2' });
      
      // Get all conversations
      const conversations = await storage.listConversations();
      
      // Verify we got at least the two we just created
      expect(conversations.length).toBeGreaterThanOrEqual(2);
    });

    it('should list conversations for a specific user', async () => {
      // Create a user
      const user = await createTestData.user(storage);
      
      // Create some conversations for that user
      await createTestData.conversation(storage, user.id, { title: 'User Conversation 1' });
      await createTestData.conversation(storage, user.id, { title: 'User Conversation 2' });
      
      // Create a conversation for another user/no user
      await createTestData.conversation(storage, null, { title: 'Other Conversation' });
      
      // Get conversations for our user
      const conversations = await storage.listConversations(user.id);
      
      // Verify we got exactly the two for our user
      expect(conversations.length).toBe(2);
      expect(conversations.every(c => c.userId === user.id)).toBe(true);
    });
  });

  // Message tests
  describe('Message Operations', () => {
    it('should create a message', async () => {
      // Create a conversation
      const conversation = await createTestData.conversation(storage);
      
      // Create a message in that conversation
      const message = await createTestData.message(storage, conversation.id, {
        role: 'user',
        content: 'Hello world',
        service: 'system'
      });
      
      // Verify the message
      expect(message).toBeDefined();
      expect(message.id).toBeGreaterThan(0);
      expect(message.conversationId).toBe(conversation.id);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello world');
      expect(message.service).toBe('system');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should get a message by ID', async () => {
      // Create a conversation and a message
      const conversation = await createTestData.conversation(storage);
      const createdMessage = await createTestData.message(storage, conversation.id);
      
      // Get the message by ID
      const message = await storage.getMessage(createdMessage.id);
      
      // Verify the message
      expect(message).toBeDefined();
      expect(message?.id).toBe(createdMessage.id);
      expect(message?.content).toBe(createdMessage.content);
    });

    it('should get messages by conversation ID', async () => {
      // Create a conversation
      const conversation = await createTestData.conversation(storage);
      
      // Add a few messages to the conversation
      await createTestData.message(storage, conversation.id, { content: 'Message 1' });
      await createTestData.message(storage, conversation.id, { content: 'Message 2' });
      await createTestData.message(storage, conversation.id, { content: 'Message 3' });
      
      // Get messages for the conversation
      const messages = await storage.getMessagesByConversation(conversation.id);
      
      // Verify we got the messages
      expect(messages.length).toBe(3);
      expect(messages.every(m => m.conversationId === conversation.id)).toBe(true);
    });

    it('should handle messages with visualization data', async () => {
      // Create a conversation
      const conversation = await createTestData.conversation(storage);
      
      // Create a message with visualization data
      const visualizationData = {
        type: 'bar',
        data: {
          labels: ['Red', 'Blue', 'Yellow'],
          datasets: [{
            label: 'Colors',
            data: [12, 19, 3]
          }]
        }
      };
      
      const message = await createTestData.message(storage, conversation.id, {
        role: 'assistant',
        content: 'Here is your chart',
        service: 'claude',
        visualizationData
      });
      
      // Verify the message
      expect(message).toBeDefined();
      expect(message.visualizationData).toEqual(visualizationData);
      
      // Get the message back from the database
      const retrievedMessage = await storage.getMessage(message.id);
      
      // Verify the visualization data was preserved
      expect(retrievedMessage?.visualizationData).toEqual(visualizationData);
    });
  });

  // Research Job tests
  describe('Research Job Operations', () => {
    it('should create a research job', async () => {
      // Create a user
      const user = await createTestData.user(storage);
      
      // Create a research job
      const job = await createTestData.researchJob(storage, user.id, {
        query: 'Test research query',
        jobId: 'job-123',
        options: { depth: 'deep' }
      });
      
      // Verify the job
      expect(job).toBeDefined();
      expect(job.id).toBeGreaterThan(0);
      expect(job.userId).toBe(user.id);
      expect(job.query).toBe('Test research query');
      expect(job.status).toBe('queued');
      expect(job.progress).toBe(0);
      expect(job.jobId).toBe('job-123');
      expect(job.options).toEqual({ depth: 'deep' });
      expect(job.startedAt).toBeInstanceOf(Date);
      expect(job.completedAt).toBeNull();
    });

    it('should update a research job status', async () => {
      // Create a job
      const job = await createTestData.researchJob(storage);
      
      // Update the job status
      const updatedJob = await storage.updateResearchJobStatus(job.id, 'processing', 25);
      
      // Verify the update
      expect(updatedJob).toBeDefined();
      expect(updatedJob.id).toBe(job.id);
      expect(updatedJob.status).toBe('processing');
      expect(updatedJob.progress).toBe(25);
      
      // Make sure it's still incomplete
      expect(updatedJob.completedAt).toBeNull();
      
      // Complete the job
      const completedJob = await storage.updateResearchJobStatus(job.id, 'completed', 100);
      
      // Verify the completion
      expect(completedJob.status).toBe('completed');
      expect(completedJob.progress).toBe(100);
      expect(completedJob.completedAt).toBeInstanceOf(Date);
    });

    it('should update a research job result', async () => {
      // Create a job
      const job = await createTestData.researchJob(storage);
      
      // Define a result
      const result = {
        summary: 'This is a summary of the research',
        findings: ['Finding 1', 'Finding 2'],
        sources: [
          { title: 'Source 1', url: 'https://example.com/1' },
          { title: 'Source 2', url: 'https://example.com/2' }
        ]
      };
      
      // Update the job with the result
      const updatedJob = await storage.updateResearchJobResult(job.id, result);
      
      // Verify the update
      expect(updatedJob).toBeDefined();
      expect(updatedJob.id).toBe(job.id);
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.progress).toBe(100);
      expect(updatedJob.result).toEqual(result);
      expect(updatedJob.completedAt).toBeInstanceOf(Date);
    });

    it('should get a research job by Bull job ID', async () => {
      // Create a unique Bull job ID
      const bullJobId = `bull-job-${Date.now()}`;
      
      // Create a job with that ID
      const createdJob = await createTestData.researchJob(storage, null, {
        jobId: bullJobId
      });
      
      // Get the job by Bull job ID
      const job = await storage.getResearchJobByBullJobId(bullJobId);
      
      // Verify the job
      expect(job).toBeDefined();
      expect(job?.id).toBe(createdJob.id);
      expect(job?.jobId).toBe(bullJobId);
    });
  });

  // Research Report tests
  describe('Research Report Operations', () => {
    it('should create a research report', async () => {
      // Create a research job
      const job = await createTestData.researchJob(storage);
      
      // Create a report for that job
      const report = await createTestData.researchReport(storage, job.id, {
        title: 'Test Report',
        content: 'This is the report content',
        summary: 'This is a summary',
        citations: [
          { title: 'Source 1', url: 'https://example.com/1' },
          { title: 'Source 2', url: 'https://example.com/2' }
        ],
        followUpQuestions: ['Question 1?', 'Question 2?']
      });
      
      // Verify the report
      expect(report).toBeDefined();
      expect(report.id).toBeGreaterThan(0);
      expect(report.jobId).toBe(job.id);
      expect(report.title).toBe('Test Report');
      expect(report.content).toBe('This is the report content');
      expect(report.summary).toBe('This is a summary');
      expect(report.citations).toEqual([
        { title: 'Source 1', url: 'https://example.com/1' },
        { title: 'Source 2', url: 'https://example.com/2' }
      ]);
      expect(report.followUpQuestions).toEqual(['Question 1?', 'Question 2?']);
      expect(report.createdAt).toBeInstanceOf(Date);
    });

    it('should get a research report by ID', async () => {
      // Create a job and a report
      const job = await createTestData.researchJob(storage);
      const createdReport = await createTestData.researchReport(storage, job.id);
      
      // Get the report by ID
      const report = await storage.getResearchReport(createdReport.id);
      
      // Verify the report
      expect(report).toBeDefined();
      expect(report?.id).toBe(createdReport.id);
      expect(report?.title).toBe(createdReport.title);
    });

    it('should list reports for a specific job', async () => {
      // Create a job
      const job = await createTestData.researchJob(storage);
      
      // Create some reports for that job
      await createTestData.researchReport(storage, job.id, { title: 'Report 1' });
      await createTestData.researchReport(storage, job.id, { title: 'Report 2' });
      
      // Create a report for another job
      const otherJob = await createTestData.researchJob(storage);
      await createTestData.researchReport(storage, otherJob.id, { title: 'Other Report' });
      
      // Get reports for our job
      const reports = await storage.listResearchReports(job.id);
      
      // Verify we got exactly the two for our job
      expect(reports.length).toBe(2);
      expect(reports.every(r => r.jobId === job.id)).toBe(true);
    });
  });

  // API Status tests
  describe('API Status Operations', () => {
    it('should get API status', async () => {
      // Get the API status
      const status = await storage.getApiStatus();
      
      // Verify the status format
      expect(status).toBeDefined();
      expect(status.claude).toBeDefined();
      expect(status.perplexity).toBeDefined();
      expect(status.server).toBeDefined();
      
      // Verify the services
      expect(status.claude.service).toBe('Claude API');
      expect(status.perplexity.service).toBe('Perplexity API');
      
      // Verify the server status
      expect(status.server.status).toBe('running');
      expect(typeof status.server.uptime).toBe('string');
    });

    it('should update service status', async () => {
      // Update the Claude service status
      await storage.updateServiceStatus('claude', {
        status: 'error',
        error: 'API key invalid',
        lastUsed: '2023-04-01T12:00:00Z'
      });
      
      // Get the API status
      const status = await storage.getApiStatus();
      
      // Verify the update
      expect(status.claude.status).toBe('error');
      expect(status.claude.error).toBe('API key invalid');
      expect(status.claude.lastUsed).toBe('2023-04-01T12:00:00Z');
      
      // Verify other services weren't affected
      expect(status.perplexity.status).toBe('connected');
    });
  });
});