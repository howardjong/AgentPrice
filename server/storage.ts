import { 
  users, type User, type InsertUser,
  conversations, type Conversation, type InsertConversation,
  messages, type Message, type InsertMessage,
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
  
  // API Status methods
  getApiStatus(): Promise<ApiStatus>;
  updateServiceStatus(service: string, status: Partial<ServiceStatus>): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private apiStatus: ApiStatus;
  private userIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.userIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    
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

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
}

export const storage = new MemStorage();
