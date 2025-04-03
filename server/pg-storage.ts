import { eq, and, isNotNull } from 'drizzle-orm';
import { db, isDatabaseAvailable } from './db';
import { IStorage } from './storage';
import logger from '@utils/logger';
import {
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  researchJobs, type ResearchJob, type InsertResearchJob,
  researchReports, type ResearchReport, type InsertResearchReport,
  type ApiStatus, type ServiceStatus
} from '@shared/schema';

/**
 * PostgreSQL Storage Implementation
 * 
 * This class implements the IStorage interface using PostgreSQL with Drizzle ORM.
 * It provides data access methods for all entities in the system.
 */
export class PgStorage implements IStorage {
  private apiStatus: ApiStatus;
  
  constructor() {
    // Initialize API status with default values
    this.apiStatus = {
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
        uptime: '0d 0h 0m',
      }
    };
  }
  
  // Helper method to check database availability
  private async checkDbAvailable() {
    const isAvailable = await isDatabaseAvailable();
    if (!isAvailable) {
      throw new Error('Database is not available');
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving user by ID', { error, userId: id });
      throw error;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(users).where(eq(users.username, username));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving user by username', { error, username });
      throw error;
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    await this.checkDbAvailable();
    try {
      const result = await db.insert(users).values(insertUser).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating user', { error, username: insertUser.username });
      throw error;
    }
  }
  
  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(conversations).where(eq(conversations.id, id));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving conversation by ID', { error, conversationId: id });
      throw error;
    }
  }
  
  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    await this.checkDbAvailable();
    try {
      const result = await db.insert(conversations).values(insertConversation).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating conversation', { error, title: insertConversation.title });
      throw error;
    }
  }
  
  async listConversations(userId?: number): Promise<Conversation[]> {
    await this.checkDbAvailable();
    try {
      if (userId) {
        return await db.select().from(conversations).where(eq(conversations.userId, userId));
      }
      return await db.select().from(conversations);
    } catch (error) {
      logger.error('Error listing conversations', { error, userId });
      throw error;
    }
  }
  
  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(messages).where(eq(messages.id, id));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving message by ID', { error, messageId: id });
      throw error;
    }
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    await this.checkDbAvailable();
    try {
      // Update service last used timestamp if applicable
      if (insertMessage.service === 'claude' || insertMessage.service === 'perplexity') {
        this.updateServiceStatus(insertMessage.service, {
          lastUsed: new Date().toISOString()
        });
      }
      
      const result = await db.insert(messages).values(insertMessage).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating message', { 
        error, 
        conversationId: insertMessage.conversationId,
        role: insertMessage.role
      });
      throw error;
    }
  }
  
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    await this.checkDbAvailable();
    try {
      return await db.select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.timestamp);
    } catch (error) {
      logger.error('Error retrieving messages by conversation', { error, conversationId });
      throw error;
    }
  }
  
  // Research Job methods
  async getResearchJob(id: number): Promise<ResearchJob | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(researchJobs).where(eq(researchJobs.id, id));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving research job by ID', { error, jobId: id });
      throw error;
    }
  }
  
  async getResearchJobByBullJobId(jobId: string): Promise<ResearchJob | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(researchJobs).where(eq(researchJobs.jobId, jobId));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving research job by Bull job ID', { error, bullJobId: jobId });
      throw error;
    }
  }
  
  async createResearchJob(insertJob: InsertResearchJob): Promise<ResearchJob> {
    await this.checkDbAvailable();
    try {
      const values = {
        ...insertJob,
        status: 'queued',
        progress: 0,
      };
      
      const result = await db.insert(researchJobs).values(values).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating research job', { error, query: insertJob.query });
      throw error;
    }
  }
  
  async updateResearchJobStatus(id: number, status: string, progress?: number): Promise<ResearchJob> {
    await this.checkDbAvailable();
    try {
      // Get the current job
      const currentJob = await this.getResearchJob(id);
      if (!currentJob) {
        throw new Error(`Research job with ID ${id} not found`);
      }
      
      // Prepare update values
      const updateValues: Partial<ResearchJob> = { status };
      
      if (progress !== undefined) {
        updateValues.progress = progress;
      }
      
      if (status === 'completed' || status === 'failed') {
        updateValues.completedAt = new Date();
      }
      
      // Update the job
      const result = await db
        .update(researchJobs)
        .set(updateValues)
        .where(eq(researchJobs.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      logger.error('Error updating research job status', { error, jobId: id, status });
      throw error;
    }
  }
  
  async updateResearchJobResult(id: number, result: any): Promise<ResearchJob> {
    await this.checkDbAvailable();
    try {
      const updateValues = {
        result,
        status: 'completed',
        progress: 100,
        completedAt: new Date()
      };
      
      const updatedJob = await db
        .update(researchJobs)
        .set(updateValues)
        .where(eq(researchJobs.id, id))
        .returning();
      
      return updatedJob[0];
    } catch (error) {
      logger.error('Error updating research job result', { error, jobId: id });
      throw error;
    }
  }
  
  async listResearchJobs(userId?: number): Promise<ResearchJob[]> {
    await this.checkDbAvailable();
    try {
      if (userId) {
        return await db.select().from(researchJobs).where(eq(researchJobs.userId, userId));
      }
      return await db.select().from(researchJobs);
    } catch (error) {
      logger.error('Error listing research jobs', { error, userId });
      throw error;
    }
  }
  
  // Research Report methods
  async getResearchReport(id: number): Promise<ResearchReport | undefined> {
    await this.checkDbAvailable();
    try {
      const result = await db.select().from(researchReports).where(eq(researchReports.id, id));
      return result[0];
    } catch (error) {
      logger.error('Error retrieving research report by ID', { error, reportId: id });
      throw error;
    }
  }
  
  async createResearchReport(insertReport: InsertResearchReport): Promise<ResearchReport> {
    await this.checkDbAvailable();
    try {
      if (!insertReport.jobId) {
        throw new Error('Research report must have a jobId');
      }
      
      const result = await db.insert(researchReports).values(insertReport).returning();
      return result[0];
    } catch (error) {
      logger.error('Error creating research report', { error, title: insertReport.title });
      throw error;
    }
  }
  
  async listResearchReports(jobId?: number): Promise<ResearchReport[]> {
    await this.checkDbAvailable();
    try {
      if (jobId) {
        return await db.select().from(researchReports).where(eq(researchReports.jobId, jobId));
      }
      return await db.select().from(researchReports);
    } catch (error) {
      logger.error('Error listing research reports', { error, jobId });
      throw error;
    }
  }
  
  // API Status methods
  async getApiStatus(): Promise<ApiStatus> {
    // Update uptime
    const serverStartTime = new Date(Date.now() - 1000 * 60 * 5); // Just for demo, 5 minutes ago
    const uptime = this.formatUptime(Date.now() - serverStartTime.getTime());
    this.apiStatus.server.uptime = uptime;
    
    return this.apiStatus;
  }
  
  async updateServiceStatus(service: string, status: Partial<ServiceStatus>): Promise<void> {
    if (service === 'claude') {
      this.apiStatus.claude = { ...this.apiStatus.claude, ...status };
    } else if (service === 'perplexity') {
      this.apiStatus.perplexity = { ...this.apiStatus.perplexity, ...status };
    }
  }
  
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
}

// Export a singleton instance for use in the application
export const pgStorage = new PgStorage();