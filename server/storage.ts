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
  getConversation(id: string): Promise<Conversation | null>; // Alias for getConversationById
  getConversationsByUserId(userId: string): Promise<Conversation[]>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null>;
  
  // Message operations
  createMessage(message: Partial<Message>): Promise<Message>;
  getMessageById(id: string): Promise<Message | null>;
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>; // Alias for getMessagesByConversationId
  
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
export async function createStorage(type: string = 'memory'): Promise<IStorage> {
  if (type === 'postgres') {
    // Dynamic import to avoid circular dependencies
    const pgStorageModule = await import('./pg-storage.js');
    const dbModule = await import('./db.js');
    return new pgStorageModule.PostgresStorage(dbModule.db);
  } else {
    // Default to memory storage
    const memoryModule = await import('./memory-storage.js');
    return new memoryModule.MemoryStorage();
  }
}

// Create a temporary memory storage instance
// This will be replaced with the proper instance once initialized
import { MemoryStorage } from './memory-storage.js';
export const storage = new MemoryStorage();

// Initialize the proper storage asynchronously
(async () => {
  try {
    const properStorage = await createStorage(process.env.STORAGE_TYPE);
    // Replace all methods in the storage instance with the proper ones
    Object.getOwnPropertyNames(Object.getPrototypeOf(properStorage))
      .filter(prop => typeof properStorage[prop] === 'function' && prop !== 'constructor')
      .forEach(method => {
        storage[method] = properStorage[method].bind(properStorage);
      });
    console.log(`Storage initialized with type: ${process.env.STORAGE_TYPE || 'memory'}`);
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
})();