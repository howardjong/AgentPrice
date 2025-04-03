/**
 * Mock Storage Test Pattern Example
 * 
 * This file demonstrates how to use mock storage for faster unit tests
 * that don't require a real database connection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestId, createTestUser, createTestConversation } from '../utils/db-test-utils';
import { IStorage } from '../../server/storage';
import type { User, Conversation, Message, ResearchJob, ResearchReport } from '../../shared/schema';

// Simplified in-memory storage implementation for tests
class MockStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message> = new Map();
  private researchJobs: Map<string, ResearchJob> = new Map();
  private researchReports: Map<string, ResearchReport> = new Map();

  // User operations
  async createUser(user: Partial<User>): Promise<User> {
    const newUser = { ...user } as User;
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const users = Array.from(this.users.values());
    return users.find(user => user.email === email) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Conversation operations
  async createConversation(conversation: Partial<Conversation>): Promise<Conversation> {
    const newConversation = { ...conversation } as Conversation;
    this.conversations.set(newConversation.id, newConversation);
    return newConversation;
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  async getConversationsByUserId(userId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conversation => conversation.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const conversation = this.conversations.get(id);
    if (!conversation) return null;
    
    const updatedConversation = { ...conversation, ...updates };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  // Message operations
  async createMessage(message: Partial<Message>): Promise<Message> {
    const newMessage = { ...message } as Message;
    this.messages.set(newMessage.id, newMessage);
    
    // Update conversation updatedAt
    const conversation = this.conversations.get(newMessage.conversationId);
    if (conversation) {
      conversation.updatedAt = new Date();
      this.conversations.set(conversation.id, conversation);
    }
    
    return newMessage;
  }

  async getMessageById(id: string): Promise<Message | null> {
    return this.messages.get(id) || null;
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Research job operations
  async createResearchJob(job: Partial<ResearchJob>): Promise<ResearchJob> {
    const newJob = { ...job } as ResearchJob;
    this.researchJobs.set(newJob.id, newJob);
    return newJob;
  }

  async getResearchJobById(id: string): Promise<ResearchJob | null> {
    return this.researchJobs.get(id) || null;
  }

  async updateResearchJob(id: string, updates: Partial<ResearchJob>): Promise<ResearchJob | null> {
    const job = this.researchJobs.get(id);
    if (!job) return null;
    
    const updatedJob = { ...job, ...updates, updatedAt: new Date() };
    this.researchJobs.set(id, updatedJob);
    return updatedJob;
  }

  // Research report operations
  async createResearchReport(report: Partial<ResearchReport>): Promise<ResearchReport> {
    const newReport = { ...report } as ResearchReport;
    this.researchReports.set(newReport.id, newReport);
    return newReport;
  }

  async getResearchReportById(id: string): Promise<ResearchReport | null> {
    return this.researchReports.get(id) || null;
  }

  async getResearchReportsByJobId(jobId: string): Promise<ResearchReport[]> {
    return Array.from(this.researchReports.values())
      .filter(report => report.jobId === jobId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

describe('Mock Storage Test Pattern', () => {
  let storage: MockStorage;
  let testId: string;
  
  beforeEach(() => {
    storage = new MockStorage();
    testId = createTestId();
  });
  
  describe('User Operations', () => {
    it('should create and retrieve a user', async () => {
      // Create test user
      const testUser = createTestUser(testId);
      const createdUser = await storage.createUser(testUser);
      
      // Verify user was created
      expect(createdUser).toEqual(testUser);
      
      // Retrieve user by ID
      const retrievedUser = await storage.getUserById(testUser.id);
      expect(retrievedUser).toEqual(testUser);
      
      // Retrieve user by email
      const retrievedByEmail = await storage.getUserByEmail(testUser.email);
      expect(retrievedByEmail).toEqual(testUser);
    });
    
    it('should update a user', async () => {
      // Create test user
      const testUser = createTestUser(testId);
      await storage.createUser(testUser);
      
      // Update user
      const updates = { name: 'Updated Name' };
      const updatedUser = await storage.updateUser(testUser.id, updates);
      
      // Verify update
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.name).toBe('Updated Name');
      expect(updatedUser?.email).toBe(testUser.email); // Other fields should remain unchanged
    });
    
    it('should return null when retrieving non-existent user', async () => {
      const nonExistentUser = await storage.getUserById('non-existent-id');
      expect(nonExistentUser).toBeNull();
    });
  });
  
  describe('Conversation and Message Operations', () => {
    it('should create conversations and messages with proper relationships', async () => {
      // Create test user
      const testUser = createTestUser(testId);
      const user = await storage.createUser(testUser);
      
      // Create conversations
      const conversation1 = createTestConversation(testId, user.id);
      const conversation2 = createTestConversation(testId, user.id, { title: 'Second Conversation' });
      
      await storage.createConversation(conversation1);
      await storage.createConversation(conversation2);
      
      // Create messages
      const message1 = {
        id: `message_${testId}_1`,
        conversationId: conversation1.id,
        content: 'Hello world',
        role: 'user',
        createdAt: new Date()
      } as Message;
      
      const message2 = {
        id: `message_${testId}_2`,
        conversationId: conversation1.id,
        content: 'Response',
        role: 'assistant',
        createdAt: new Date(Date.now() + 1000) // 1 second later
      } as Message;
      
      await storage.createMessage(message1);
      await storage.createMessage(message2);
      
      // Retrieve conversations for user
      const userConversations = await storage.getConversationsByUserId(user.id);
      expect(userConversations).toHaveLength(2);
      
      // Retrieve messages for conversation
      const conversationMessages = await storage.getMessagesByConversationId(conversation1.id);
      expect(conversationMessages).toHaveLength(2);
      expect(conversationMessages[0].content).toBe('Hello world');
      expect(conversationMessages[1].content).toBe('Response');
    });
    
    it('should update conversation timestamp when adding a message', async () => {
      // Setup spy for Date
      const originalDate = global.Date;
      const mockDate = vi.fn(() => new Date('2025-04-03T12:00:00Z'));
      mockDate.now = vi.fn(() => new Date('2025-04-03T12:00:00Z').getTime());
      global.Date = mockDate as any;
      
      // Create test data
      const testUser = createTestUser(testId);
      const user = await storage.createUser(testUser);
      const conversation = createTestConversation(testId, user.id);
      await storage.createConversation(conversation);
      
      // Change mock date for message creation
      mockDate.now = vi.fn(() => new Date('2025-04-03T12:30:00Z').getTime());
      mockDate.mockReturnValue(new Date('2025-04-03T12:30:00Z'));
      
      // Create message
      const message = {
        id: `message_${testId}_1`,
        conversationId: conversation.id,
        content: 'New message',
        role: 'user',
        createdAt: new Date()
      } as Message;
      
      await storage.createMessage(message);
      
      // Verify conversation timestamp was updated
      const updatedConversation = await storage.getConversationById(conversation.id);
      expect(updatedConversation?.updatedAt.getTime()).toBe(new Date('2025-04-03T12:30:00Z').getTime());
      
      // Restore original Date
      global.Date = originalDate;
    });
  });
});