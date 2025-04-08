/**
 * PostgreSQL Storage Implementation
 * 
 * This file provides a PostgreSQL implementation of the storage interface.
 * Used for production database operations.
 */

import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export class PostgresStorage {
  constructor(db) {
    this.db = db;
    this.apiStatus = {
      claude: { status: 'unknown', lastChecked: new Date().toISOString() },
      perplexity: { status: 'unknown', lastChecked: new Date().toISOString() },
      server: { status: 'running', version: '1.0.0' }
    };
    console.log('PostgreSQL storage initialized');
  }

  // User operations
  async createUser(user) {
    const id = user.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT INTO users (id, username, email, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      user.username,
      user.email,
      timestamp
    ]);
    
    return result.rows[0];
  }

  async getUserById(id) {
    const query = `SELECT * FROM users WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email) {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await this.db.query(query, [email]);
    return result.rows[0] || null;
  }

  async updateUser(id, updates) {
    // Build dynamic update query
    const updateFields = Object.keys(updates)
      .map((key, index) => `${this.toSnakeCase(key)} = $${index + 2}`)
      .join(', ');
    
    const query = `
      UPDATE users
      SET ${updateFields}
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, ...Object.values(updates)];
    const result = await this.db.query(query, values);
    
    return result.rows[0] || null;
  }

  // Conversation operations
  async createConversation(conversation) {
    const id = conversation.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT INTO conversations (id, title, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      conversation.title,
      conversation.userId,
      timestamp,
      timestamp
    ]);
    
    return this.toCamelCase(result.rows[0]);
  }

  async getConversationById(id) {
    const query = `SELECT * FROM conversations WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.toCamelCase(result.rows[0]) : null;
  }

  async getConversationsByUserId(userId) {
    const query = `SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC`;
    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.toCamelCase(row));
  }

  async updateConversation(id, updates) {
    // Build dynamic update query
    const updateFields = Object.keys(updates)
      .map((key, index) => `${this.toSnakeCase(key)} = $${index + 2}`)
      .join(', ');
    
    const query = `
      UPDATE conversations
      SET ${updateFields}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, ...Object.values(updates)];
    const result = await this.db.query(query, values);
    
    return result.rows[0] ? this.toCamelCase(result.rows[0]) : null;
  }

  // Message operations
  async createMessage(message) {
    const id = message.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT INTO messages (
        id, conversation_id, role, content, service, 
        visualization_data, citations, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      message.conversationId,
      message.role,
      message.content,
      message.service,
      message.visualizationData ? JSON.stringify(message.visualizationData) : null,
      message.citations ? JSON.stringify(message.citations) : null,
      message.metadata ? JSON.stringify(message.metadata) : null,
      timestamp
    ]);
    
    return this.toCamelCase(result.rows[0]);
  }

  async getMessageById(id) {
    const query = `SELECT * FROM messages WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.toCamelCase(result.rows[0]) : null;
  }

  async getMessagesByConversationId(conversationId) {
    const query = `
      SELECT * FROM messages 
      WHERE conversation_id = $1 
      ORDER BY created_at ASC
    `;
    
    const result = await this.db.query(query, [conversationId]);
    return result.rows.map(row => this.toCamelCase(row));
  }
  
  // Alias method for getMessagesByConversationId to match the interface
  async getMessagesByConversation(conversationId) {
    return this.getMessagesByConversationId(conversationId);
  }

  // Research job operations
  async createResearchJob(job) {
    const id = job.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT INTO research_jobs (
        id, conversation_id, query, status, service, 
        metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      job.conversationId,
      job.query,
      job.status || 'pending',
      job.service,
      job.metadata ? JSON.stringify(job.metadata) : null,
      timestamp,
      timestamp
    ]);
    
    return this.toCamelCase(result.rows[0]);
  }

  async getResearchJobById(id) {
    const query = `SELECT * FROM research_jobs WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.toCamelCase(result.rows[0]) : null;
  }

  async updateResearchJob(id, updates) {
    // Process any JSON fields
    const processedUpdates = { ...updates };
    if (updates.metadata) {
      processedUpdates.metadata = JSON.stringify(updates.metadata);
    }
    
    // Build dynamic update query
    const updateFields = Object.keys(processedUpdates)
      .map((key, index) => `${this.toSnakeCase(key)} = $${index + 2}`)
      .join(', ');
    
    let query = `
      UPDATE research_jobs
      SET ${updateFields}, updated_at = NOW()
    `;
    
    // Add completedAt if status is completed
    if (updates.status === 'completed') {
      query += `, completed_at = NOW()`;
    }
    
    query += ` WHERE id = $1 RETURNING *`;
    
    const values = [id, ...Object.values(processedUpdates)];
    const result = await this.db.query(query, values);
    
    return result.rows[0] ? this.toCamelCase(result.rows[0]) : null;
  }

  // Research report operations
  async createResearchReport(report) {
    const id = report.id || uuidv4();
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT INTO research_reports (
        id, job_id, content, source, source_type,
        metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await this.db.query(query, [
      id,
      report.jobId,
      report.content,
      report.source,
      report.sourceType,
      report.metadata ? JSON.stringify(report.metadata) : null,
      timestamp
    ]);
    
    return this.toCamelCase(result.rows[0]);
  }

  async getResearchReportById(id) {
    const query = `SELECT * FROM research_reports WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.toCamelCase(result.rows[0]) : null;
  }

  async getResearchReportsByJobId(jobId) {
    const query = `
      SELECT * FROM research_reports 
      WHERE job_id = $1 
      ORDER BY created_at ASC
    `;
    
    const result = await this.db.query(query, [jobId]);
    return result.rows.map(row => this.toCamelCase(row));
  }

  // API status operations
  async updateServiceStatus(service, status) {
    try {
      // Update the in-memory status
      if (this.apiStatus[service]) {
        this.apiStatus[service] = {
          ...this.apiStatus[service],
          ...status,
          lastChecked: new Date().toISOString()
        };
        
        // In a production implementation, you would also update a database table
        // For example:
        // const query = `
        //   INSERT INTO api_status (service, status, last_checked)
        //   VALUES ($1, $2, NOW())
        //   ON CONFLICT (service) DO UPDATE
        //   SET status = $2, last_checked = NOW()
        // `;
        // await this.db.query(query, [service, JSON.stringify(status)]);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error updating service status for ${service}:`, error);
      return false;
    }
  }

  async getApiStatus() {
    try {
      // In a production implementation, you would retrieve this from a database
      // For example:
      // const query = `SELECT * FROM api_status`;
      // const result = await this.db.query(query);
      // const status = {};
      // result.rows.forEach(row => {
      //   status[row.service] = JSON.parse(row.status);
      // });
      // return status;
      
      // For now, just return the in-memory status
      return { ...this.apiStatus };
    } catch (error) {
      console.error('Error getting API status:', error);
      // Return a default status in case of errors
      return {
        claude: { status: 'unknown', lastChecked: new Date().toISOString() },
        perplexity: { status: 'unknown', lastChecked: new Date().toISOString() },
        server: { status: 'running', version: '1.0.0' }
      };
    }
  }

  // Utility methods for handling snake_case <-> camelCase conversion
  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  toCamelCase(obj) {
    if (!obj) return null;
    
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      // Parse JSON fields
      let parsedValue = value;
      if (typeof value === 'string' && 
          (key === 'visualization_data' || key === 'citations' || key === 'metadata')) {
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          // Keep original value if not valid JSON
          parsedValue = value;
        }
      }
      
      newObj[camelKey] = parsedValue;
    }
    
    return newObj;
  }
}