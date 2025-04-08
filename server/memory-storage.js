/**
 * In-Memory Storage Implementation
 * 
 * This file provides an in-memory implementation of the storage interface.
 * Used for development and testing purposes.
 */

export class MemoryStorage {
  constructor() {
    this.apiStatus = {
      claude: { 
        status: 'connected', 
        lastChecked: new Date().toISOString(),
        version: 'claude-3-7-sonnet-20250219'
      },
      perplexity: { 
        status: 'connected', 
        lastChecked: new Date().toISOString(),
        version: 'llama-3.1-sonar-small-128k-online'
      },
      server: { 
        status: 'running', 
        version: '1.0.0',
        load: 0.2,
        uptime: '0:00:30'
      }
    };
    console.log('In-memory storage initialized');
  }

  // API status operations
  async updateServiceStatus(service, status) {
    if (this.apiStatus[service]) {
      this.apiStatus[service] = {
        ...this.apiStatus[service],
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

  // Stub implementations for the IStorage interface methods
  async createUser() { return null; }
  async getUserById() { return null; }
  async getUserByEmail() { return null; }
  async updateUser() { return null; }
  async createConversation() { return null; }
  async getConversationById() { return null; }
  async getConversation() { return null; }
  async getConversationsByUserId() { return []; }
  async updateConversation() { return null; }
  async createMessage() { return null; }
  async getMessageById() { return null; }
  async getMessagesByConversationId() { return []; }
  async getMessagesByConversation() { return []; }
  async createResearchJob() { return null; }
  async getResearchJobById() { return null; }
  async updateResearchJob() { return null; }
  async createResearchReport() { return null; }
  async getResearchReportById() { return null; }
  async getResearchReportsByJobId() { return []; }
}