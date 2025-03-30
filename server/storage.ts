import { 
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
  researchJobs, type ResearchJob, type InsertResearchJob,
  researchReports, type ResearchReport, type InsertResearchReport,
  type ApiStatus, type ServiceStatus
} from "@shared/schema";

// Modify the interface with any CRUD methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Conversation methods
  getConversation(id: number): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  listConversations(userId?: number): Promise<Conversation[]>;
  
  // Message methods
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  
  // Research Job methods
  getResearchJob(id: number): Promise<ResearchJob | undefined>;
  getResearchJobByBullJobId(jobId: string): Promise<ResearchJob | undefined>;
  createResearchJob(job: InsertResearchJob): Promise<ResearchJob>;
  updateResearchJobStatus(id: number, status: string, progress?: number): Promise<ResearchJob>;
  updateResearchJobResult(id: number, result: any): Promise<ResearchJob>;
  listResearchJobs(userId?: number): Promise<ResearchJob[]>;
  
  // Research Report methods
  getResearchReport(id: number): Promise<ResearchReport | undefined>;
  createResearchReport(report: InsertResearchReport): Promise<ResearchReport>;
  listResearchReports(jobId?: number): Promise<ResearchReport[]>;
  
  // API Status methods
  getApiStatus(): Promise<ApiStatus>;
  updateServiceStatus(service: string, status: Partial<ServiceStatus>): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private researchJobs: Map<number, ResearchJob>;
  private researchReports: Map<number, ResearchReport>;
  private apiStatus: ApiStatus;
  private userIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  private researchJobIdCounter: number;
  private researchReportIdCounter: number;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.researchJobs = new Map();
    this.researchReports = new Map();
    this.userIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    this.researchJobIdCounter = 1;
    this.researchReportIdCounter = 1;
    
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
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationIdCounter++;
    const now = new Date();
    // Ensure userId is non-undefined even if null
    const userId = insertConversation.userId ?? null;
    const conversation: Conversation = {
      ...insertConversation,
      userId,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async listConversations(userId?: number): Promise<Conversation[]> {
    const allConversations = Array.from(this.conversations.values());
    if (userId) {
      return allConversations.filter(conv => conv.userId === userId);
    }
    return allConversations;
  }

  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    // Create message with explicitly typed fields
    const message = {
      id,
      conversationId: insertMessage.conversationId,
      role: insertMessage.role,
      content: insertMessage.content,
      service: insertMessage.service,
      visualizationData: insertMessage.visualizationData ?? null,
      citations: insertMessage.citations ?? null,
      timestamp: now,
    } as Message;
    this.messages.set(id, message);
    
    // Update the last used timestamp for the service
    if (message.service === 'claude' || message.service === 'perplexity') {
      this.updateServiceStatus(message.service, {
        lastUsed: now.toISOString()
      });
    }
    
    return message;
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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

  // Research Job methods
  async getResearchJob(id: number): Promise<ResearchJob | undefined> {
    return this.researchJobs.get(id);
  }

  async getResearchJobByBullJobId(jobId: string): Promise<ResearchJob | undefined> {
    return Array.from(this.researchJobs.values()).find(
      (job) => job.jobId === jobId
    );
  }

  async createResearchJob(insertJob: InsertResearchJob): Promise<ResearchJob> {
    const id = this.researchJobIdCounter++;
    const now = new Date();
    // Ensure userId is non-undefined even if null
    const userId = insertJob.userId ?? null;
    
    const job: ResearchJob = {
      id,
      userId,
      query: insertJob.query,
      status: 'queued',
      progress: 0,
      jobId: insertJob.jobId,
      options: insertJob.options ?? null,
      result: null,
      error: null,
      startedAt: now,
      completedAt: null
    };
    
    this.researchJobs.set(id, job);
    return job;
  }

  async updateResearchJobStatus(id: number, status: string, progress?: number): Promise<ResearchJob> {
    const job = this.researchJobs.get(id);
    if (!job) {
      throw new Error(`Research job with ID ${id} not found`);
    }
    
    const updatedJob = { ...job, status };
    
    if (progress !== undefined) {
      updatedJob.progress = progress;
    } else {
      updatedJob.progress = job.progress; // Preserve existing progress if not specified
    }
    
    if (status === 'completed' || status === 'failed') {
      updatedJob.completedAt = new Date();
    }
    
    this.researchJobs.set(id, updatedJob);
    return updatedJob;
  }

  async updateResearchJobResult(id: number, result: any): Promise<ResearchJob> {
    const job = this.researchJobs.get(id);
    if (!job) {
      throw new Error(`Research job with ID ${id} not found`);
    }
    
    const updatedJob = { 
      ...job, 
      result,
      status: 'completed',
      progress: 100,
      completedAt: new Date()
    };
    
    this.researchJobs.set(id, updatedJob);
    return updatedJob;
  }

  async listResearchJobs(userId?: number): Promise<ResearchJob[]> {
    const allJobs = Array.from(this.researchJobs.values());
    if (userId) {
      return allJobs.filter(job => job.userId === userId);
    }
    return allJobs;
  }

  // Research Report methods
  async getResearchReport(id: number): Promise<ResearchReport | undefined> {
    return this.researchReports.get(id);
  }

  async createResearchReport(insertReport: InsertResearchReport): Promise<ResearchReport> {
    const id = this.researchReportIdCounter++;
    const now = new Date();
    
    if (!insertReport.jobId) {
      throw new Error('Research report must have a jobId');
    }
    
    // Ensure we have non-undefined values for optional fields
    const summary = insertReport.summary ?? null;
    const citations = insertReport.citations ?? null;
    const followUpQuestions = insertReport.followUpQuestions ?? null;
    const filePath = insertReport.filePath ?? null;
    
    // Explicitly cast the job ID to make TypeScript happy
    const jobId: number = insertReport.jobId;
    
    const report: ResearchReport = {
      id,
      jobId,
      title: insertReport.title,
      content: insertReport.content,
      summary,
      citations,
      followUpQuestions,
      filePath,
      createdAt: now
    };
    
    this.researchReports.set(id, report);
    return report;
  }

  async listResearchReports(jobId?: number): Promise<ResearchReport[]> {
    const allReports = Array.from(this.researchReports.values());
    if (jobId) {
      return allReports.filter(report => report.jobId === jobId);
    }
    return allReports;
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
}

export const storage = new MemStorage();
