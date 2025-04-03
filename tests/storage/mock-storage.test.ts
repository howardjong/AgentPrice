import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDatabase } from '../utils/db-test-utils';
import type { IStorage } from '../../server/storage';

/**
 * Mock Storage Tests
 * 
 * These tests demonstrate how to use mocked storage for unit testing
 * service components that depend on storage but don't need a real database.
 */

// Define a sample service class that uses storage
class UserService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }
  
  async getUserById(id: number) {
    return this.storage.getUser(id);
  }
  
  async getUserByUsername(username: string) {
    return this.storage.getUserByUsername(username);
  }
  
  async createUser(username: string, password: string) {
    // Check if user already exists
    const existingUser = await this.storage.getUserByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }
    
    // Create new user
    return this.storage.createUser({ username, password });
  }
  
  async getMessagesForUser(userId: number) {
    // Get all conversations for user
    const conversations = await this.storage.listConversations(userId);
    
    // Get messages for each conversation
    const messagePromises = conversations.map(conversation => 
      this.storage.getMessagesByConversation(conversation.id)
    );
    
    // Return flattened array of messages
    return (await Promise.all(messagePromises)).flat();
  }
}

// Setup mock database
const { mockStorage } = mockDatabase();
let userService: UserService;

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
  userService = new UserService(mockStorage);
});

describe('UserService with Mocked Storage', () => {
  it('should get a user by ID', async () => {
    // Setup mock return value
    const mockUser = { id: 1, username: 'testuser', password: 'hashed_password' };
    vi.mocked(mockStorage.getUser).mockResolvedValue(mockUser);
    
    // Call the service method
    const user = await userService.getUserById(1);
    
    // Assert the result
    expect(user).toEqual(mockUser);
    
    // Verify the storage method was called with the correct parameters
    expect(mockStorage.getUser).toHaveBeenCalledWith(1);
    expect(mockStorage.getUser).toHaveBeenCalledTimes(1);
  });
  
  it('should get a user by username', async () => {
    // Setup mock return value
    const mockUser = { id: 1, username: 'testuser', password: 'hashed_password' };
    vi.mocked(mockStorage.getUserByUsername).mockResolvedValue(mockUser);
    
    // Call the service method
    const user = await userService.getUserByUsername('testuser');
    
    // Assert the result
    expect(user).toEqual(mockUser);
    
    // Verify the storage method was called correctly
    expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('testuser');
    expect(mockStorage.getUserByUsername).toHaveBeenCalledTimes(1);
  });
  
  it('should create a new user if username is available', async () => {
    // Setup mock return values
    vi.mocked(mockStorage.getUserByUsername).mockResolvedValue(undefined);
    const mockCreatedUser = { id: 1, username: 'newuser', password: 'hashed_password' };
    vi.mocked(mockStorage.createUser).mockResolvedValue(mockCreatedUser);
    
    // Call the service method
    const user = await userService.createUser('newuser', 'password123');
    
    // Assert the result
    expect(user).toEqual(mockCreatedUser);
    
    // Verify the storage methods were called correctly
    expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('newuser');
    expect(mockStorage.createUser).toHaveBeenCalledWith({
      username: 'newuser',
      password: 'password123'
    });
  });
  
  it('should throw an error if username already exists', async () => {
    // Setup mock return values
    const existingUser = { id: 1, username: 'existinguser', password: 'hashed_password' };
    vi.mocked(mockStorage.getUserByUsername).mockResolvedValue(existingUser);
    
    // Call the service method and expect it to throw
    await expect(userService.createUser('existinguser', 'password123'))
      .rejects.toThrow('Username already exists');
    
    // Verify the storage methods were called correctly
    expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('existinguser');
    expect(mockStorage.createUser).not.toHaveBeenCalled();
  });
  
  it('should get all messages for a user', async () => {
    // Setup mock return values
    const mockConversations = [
      { id: 1, userId: 1, title: 'Conversation 1', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, userId: 1, title: 'Conversation 2', createdAt: new Date(), updatedAt: new Date() }
    ];
    
    const mockMessages1 = [
      { id: 1, conversationId: 1, role: 'user', content: 'Hello', service: 'system', timestamp: new Date() }
    ];
    
    const mockMessages2 = [
      { id: 2, conversationId: 2, role: 'user', content: 'Hi there', service: 'system', timestamp: new Date() },
      { id: 3, conversationId: 2, role: 'assistant', content: 'How can I help?', service: 'claude', timestamp: new Date() }
    ];
    
    vi.mocked(mockStorage.listConversations).mockResolvedValue(mockConversations);
    vi.mocked(mockStorage.getMessagesByConversation).mockImplementation(async (conversationId) => {
      if (conversationId === 1) return mockMessages1;
      if (conversationId === 2) return mockMessages2;
      return [];
    });
    
    // Call the service method
    const messages = await userService.getMessagesForUser(1);
    
    // Assert the result
    expect(messages).toHaveLength(3);
    expect(messages).toEqual([...mockMessages1, ...mockMessages2]);
    
    // Verify the storage methods were called correctly
    expect(mockStorage.listConversations).toHaveBeenCalledWith(1);
    expect(mockStorage.getMessagesByConversation).toHaveBeenCalledTimes(2);
    expect(mockStorage.getMessagesByConversation).toHaveBeenCalledWith(1);
    expect(mockStorage.getMessagesByConversation).toHaveBeenCalledWith(2);
  });
});