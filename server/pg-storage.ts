/**
 * PostgreSQL implementation of the Storage interface
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from './db';
import {
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  researchJobs, type ResearchJob, type InsertResearchJob,
  researchReports, type ResearchReport, type InsertResearchReport,
  type ApiStatus, type ServiceStatus
} from '../shared/schema';
import { IStorage } from './storage';

export class PgStorage implements IStorage {
  private apiStatus: ApiStatus;

  constructor() {
    // Initialize API status
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

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(conversation).returning();
    return result[0];
  }

  async listConversations(userId?: number): Promise<Conversation[]> {
    if (userId) {
      return db.select().from(conversations).where(eq(conversations.userId, userId));
    }
    return db.select().from(conversations);
  }

  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    
    // Update the last used timestamp for the service
    if (message.service === 'claude' || message.service === 'perplexity') {
      this.updateServiceStatus(message.service, {
        lastUsed: new Date().toISOString()
      });
    }
    
    return result[0];
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }

  // Research Job methods
  async getResearchJob(id: number): Promise<ResearchJob | undefined> {
    const result = await db.select().from(researchJobs).where(eq(researchJobs.id, id));
    return result[0];
  }

  async getResearchJobByBullJobId(jobId: string): Promise<ResearchJob | undefined> {
    const result = await db.select().from(researchJobs).where(eq(researchJobs.jobId, jobId));
    return result[0];
  }

  async createResearchJob(job: InsertResearchJob): Promise<ResearchJob> {
    const result = await db.insert(researchJobs).values({
      ...job,
      status: 'queued',
      progress: 0,
    }).returning();
    return result[0];
  }

  async updateResearchJobStatus(id: number, status: string, progress?: number): Promise<ResearchJob> {
    // Get current job
    const currentJob = await this.getResearchJob(id);
    if (!currentJob) {
      throw new Error(`Research job with ID ${id} not found`);
    }

    // Prepare update values
    const updateValues: any = { status };
    
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
  }

  async updateResearchJobResult(id: number, result: any): Promise<ResearchJob> {
    const updated = await db
      .update(researchJobs)
      .set({
        result,
        status: 'completed',
        progress: 100,
        completedAt: new Date()
      })
      .where(eq(researchJobs.id, id))
      .returning();
      
    return updated[0];
  }

  async listResearchJobs(userId?: number): Promise<ResearchJob[]> {
    if (userId) {
      return db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.userId, userId))
        .orderBy(desc(researchJobs.startedAt));
    }
    
    return db
      .select()
      .from(researchJobs)
      .orderBy(desc(researchJobs.startedAt));
  }

  // Research Report methods
  async getResearchReport(id: number): Promise<ResearchReport | undefined> {
    const result = await db.select().from(researchReports).where(eq(researchReports.id, id));
    return result[0];
  }

  async createResearchReport(report: InsertResearchReport): Promise<ResearchReport> {
    const result = await db.insert(researchReports).values(report).returning();
    return result[0];
  }

  async listResearchReports(jobId?: number): Promise<ResearchReport[]> {
    if (jobId) {
      return db
        .select()
        .from(researchReports)
        .where(eq(researchReports.jobId, jobId))
        .orderBy(desc(researchReports.createdAt));
    }
    
    return db
      .select()
      .from(researchReports)
      .orderBy(desc(researchReports.createdAt));
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