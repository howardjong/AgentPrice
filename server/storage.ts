/**
 * Storage Interface Definition
 * 
 * This file defines the storage interface that all storage implementations must implement.
 * It provides a consistent API for database operations regardless of the underlying storage technology.
 */

import { 
  User, Conversation, Message, ResearchJob, ResearchReport 
} from '../shared/schema';

/**
 * Storage interface that defines all database operations
 */
export interface IStorage {
  // User operations
  createUser(user: Partial<User>): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User | null>;
  
  // Conversation operations
  createConversation(conversation: Partial<Conversation>): Promise<Conversation>;
  getConversationById(id: string): Promise<Conversation | null>;
  getConversationsByUserId(userId: string): Promise<Conversation[]>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null>;
  
  // Message operations
  createMessage(message: Partial<Message>): Promise<Message>;
  getMessageById(id: string): Promise<Message | null>;
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  
  // Research job operations
  createResearchJob(job: Partial<ResearchJob>): Promise<ResearchJob>;
  getResearchJobById(id: string): Promise<ResearchJob | null>;
  updateResearchJob(id: string, updates: Partial<ResearchJob>): Promise<ResearchJob | null>;
  
  // Research report operations
  createResearchReport(report: Partial<ResearchReport>): Promise<ResearchReport>;
  getResearchReportById(id: string): Promise<ResearchReport | null>;
  getResearchReportsByJobId(jobId: string): Promise<ResearchReport[]>;
}

/**
 * Factory function to create a storage instance based on environment configuration
 */
export function createStorage(type: string = 'memory'): IStorage {
  if (type === 'postgres') {
    // Dynamic import to avoid circular dependencies
    const { PostgresStorage } = require('./pg-storage');
    const { db } = require('./db');
    return new PostgresStorage(db);
  } else {
    // Default to memory storage
    const { MemoryStorage } = require('./memory-storage');
    return new MemoryStorage();
  }
}

// Default storage instance
export const storage = createStorage(process.env.STORAGE_TYPE);