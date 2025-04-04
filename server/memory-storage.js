/**
 * In-Memory Storage Implementation
 * 
 * This file provides an in-memory implementation of the storage interface.
 * Used for development and testing purposes.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory storage implementation of the IStorage interface
 */
export class MemoryStorage {
  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.researchJobs = new Map();
    this.researchReports = new Map();
    this.apiStatus = {
      claude: { available: false, lastChecked: null },
      perplexity: { available: false, lastChecked: null },
      server: { available: true, lastChecked: new Date().toISOString() }
    };
    console.log('In-memory storage initialized');
  }

  // User operations
  async createUser(user) {
    const id = user.id || uuidv4();
    const timestamp = new Date().toISOString();
    const newUser = {
      ...user,
      id,
      createdAt: timestamp
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async getUserById(id) {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Conversation operations
  async createConversation(conversation) {
    const id = conversation.id || uuidv4();
    const timestamp = new Date().toISOString();
    const newConversation = {
      ...conversation,
      id,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async getConversationById(id) {
    return this.conversations.get(id) || null;
  }

  async getConversationsByUserId(userId) {
    const result = [];
    for (const conversation of this.conversations.values()) {
      if (conversation.userId === userId) {
        result.push(conversation);
      }
    }
    return result;
  }

  async updateConversation(id, updates) {
    const conversation = this.conversations.get(id);
    if (!conversation) return null;

    const updatedConversation = { 
      ...conversation, 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  // Message operations
  async createMessage(message) {
    const id = message.id || uuidv4();
    const timestamp = new Date().toISOString();
    const newMessage = {
      ...message,
      id,
      createdAt: timestamp,
      metadata: message.metadata || null
    };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async getMessageById(id) {
    return this.messages.get(id) || null;
  }

  async getMessagesByConversationId(conversationId) {
    const result = [];
    for (const message of this.messages.values()) {
      if (message.conversationId === conversationId) {
        result.push(message);
      }
    }
    return result.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  // Research job operations
  async createResearchJob(job) {
    const id = job.id || uuidv4();
    const timestamp = new Date().toISOString();
    const newJob = {
      ...job,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      error: null,
      metadata: job.metadata || null
    };
    this.researchJobs.set(id, newJob);
    return newJob;
  }

  async getResearchJobById(id) {
    return this.researchJobs.get(id) || null;
  }

  async updateResearchJob(id, updates) {
    const job = this.researchJobs.get(id);
    if (!job) return null;

    const updatedJob = { 
      ...job, 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    if (updates.status === 'completed' && !updatedJob.completedAt) {
      updatedJob.completedAt = new Date().toISOString();
    }
    
    this.researchJobs.set(id, updatedJob);
    return updatedJob;
  }

  // Research report operations
  async createResearchReport(report) {
    const id = report.id || uuidv4();
    const timestamp = new Date().toISOString();
    const newReport = {
      ...report,
      id,
      createdAt: timestamp,
      metadata: report.metadata || null
    };
    this.researchReports.set(id, newReport);
    return newReport;
  }

  async getResearchReportById(id) {
    return this.researchReports.get(id) || null;
  }

  async getResearchReportsByJobId(jobId) {
    const result = [];
    for (const report of this.researchReports.values()) {
      if (report.jobId === jobId) {
        result.push(report);
      }
    }
    return result;
  }

  // API status operations
  async updateServiceStatus(service, status) {
    if (this.apiStatus[service]) {
      this.apiStatus[service] = {
        ...status,
        lastChecked: new Date().toISOString()
      };
      return true;
    }
    return false;
  }

  async getApiStatus() {
    return { ...this.apiStatus };
  }
}