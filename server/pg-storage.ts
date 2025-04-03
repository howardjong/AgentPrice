/**
 * PostgreSQL Storage Implementation
 * 
 * This file implements the storage interface using PostgreSQL with Drizzle ORM.
 */

import { IStorage } from './storage';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import { 
  users, conversations, messages, researchJobs, researchReports,
  type User, type Conversation, type Message, type ResearchJob, type ResearchReport
} from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * PostgreSQL implementation of the storage interface
 */
export class PostgresStorage implements IStorage {
  // We use 'db' rather than 'typeof db' to avoid circular type reference
  constructor(private readonly db: any) {}

  // User operations
  async createUser(user: any): Promise<User> {
    const userId = user.id || `user-${uuidv4()}`;
    const now = new Date();
    
    const result = await this.db.insert(users).values({
      id: userId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt || user.created_at || now
    }).returning();
    
    return result[0];
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result.length > 0 ? result[0] : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const result = await this.db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  // Conversation operations
  async createConversation(conversation: any): Promise<Conversation> {
    const conversationId = conversation.id || `conversation-${uuidv4()}`;
    const now = new Date();
    
    const result = await this.db.insert(conversations).values({
      id: conversationId,
      title: conversation.title,
      userId: conversation.userId || conversation.user_id,
      createdAt: conversation.createdAt || conversation.created_at || now,
      updatedAt: conversation.updatedAt || conversation.updated_at || now
    }).returning();
    
    return result[0];
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const result = await this.db.select().from(conversations).where(eq(conversations.id, id));
    return result.length > 0 ? result[0] : null;
  }

  async getConversationsByUserId(userId: string): Promise<Conversation[]> {
    return await this.db.select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    // Ensure updatedAt is set
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const result = await this.db.update(conversations)
      .set(updatesWithTimestamp)
      .where(eq(conversations.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  // Message operations
  async createMessage(message: any): Promise<Message> {
    const messageId = message.id || `message-${uuidv4()}`;
    const now = new Date();
    
    const result = await this.db.insert(messages).values({
      id: messageId,
      conversationId: message.conversationId || message.conversation_id,
      content: message.content,
      role: message.role,
      createdAt: message.createdAt || message.created_at || now,
      metadata: message.metadata
    }).returning();
    
    // Update the conversation's updatedAt timestamp
    await this.db.update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, message.conversationId || message.conversation_id));
    
    return result[0];
  }

  async getMessageById(id: string): Promise<Message | null> {
    const result = await this.db.select().from(messages).where(eq(messages.id, id));
    return result.length > 0 ? result[0] : null;
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return await this.db.select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  // Research job operations
  async createResearchJob(job: any): Promise<ResearchJob> {
    const jobId = job.id || `job-${uuidv4()}`;
    const now = new Date();
    
    const result = await this.db.insert(researchJobs).values({
      id: jobId,
      query: job.query,
      status: job.status || 'pending',
      userId: job.userId || job.user_id,
      createdAt: job.createdAt || job.created_at || now,
      updatedAt: job.updatedAt || job.updated_at || now,
      completedAt: job.completedAt || job.completed_at,
      error: job.error,
      metadata: job.metadata
    }).returning();
    
    return result[0];
  }

  async getResearchJobById(id: string): Promise<ResearchJob | null> {
    const result = await this.db.select().from(researchJobs).where(eq(researchJobs.id, id));
    return result.length > 0 ? result[0] : null;
  }

  async updateResearchJob(id: string, updates: Partial<ResearchJob>): Promise<ResearchJob | null> {
    // Ensure updatedAt is set
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date()
    };
    
    const result = await this.db.update(researchJobs)
      .set(updatesWithTimestamp)
      .where(eq(researchJobs.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  }

  // Research report operations
  async createResearchReport(report: any): Promise<ResearchReport> {
    const reportId = report.id || `report-${uuidv4()}`;
    const now = new Date();
    
    const result = await this.db.insert(researchReports).values({
      id: reportId,
      jobId: report.jobId || report.job_id,
      content: report.content,
      createdAt: report.createdAt || report.created_at || now,
      metadata: report.metadata
    }).returning();
    
    return result[0];
  }

  async getResearchReportById(id: string): Promise<ResearchReport | null> {
    const result = await this.db.select().from(researchReports).where(eq(researchReports.id, id));
    return result.length > 0 ? result[0] : null;
  }

  async getResearchReportsByJobId(jobId: string): Promise<ResearchReport[]> {
    return await this.db.select()
      .from(researchReports)
      .where(eq(researchReports.jobId, jobId))
      .orderBy(researchReports.createdAt);
  }
}