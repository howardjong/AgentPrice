/**
 * Mock Storage Tests
 * These tests show how to use the mock database utilities for unit testing
 */
import { describe, expect, it, vi } from 'vitest';
import { mockDatabase } from '../utils/db-test-utils';
import type { IStorage } from '../../server/storage';

// Hypothetical service that uses the storage
class ConversationService {
  constructor(private storage: IStorage) {}

  async createConversation(userId: number | null, title: string) {
    return this.storage.createConversation({
      userId,
      title,
    });
  }

  async addMessage(conversationId: number, message: string, role: string = 'user') {
    return this.storage.createMessage({
      conversationId,
      role,
      content: message,
      service: 'system',
    });
  }

  async getConversationWithMessages(conversationId: number) {
    const conversation = await this.storage.getConversation(conversationId);
    if (!conversation) return null;

    const messages = await this.storage.getMessagesByConversation(conversationId);
    return { conversation, messages };
  }
}

describe('ConversationService with Mock Storage', () => {
  // Get the mock storage
  const { mockStorage, mockStore } = mockDatabase();
  let service: ConversationService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Create a new service with the mock storage
    service = new ConversationService(mockStorage);
    
    // Clear the mock store
    mockStore.users.clear();
    mockStore.conversations.clear();
    mockStore.messages.clear();
    mockStore.researchJobs.clear();
    mockStore.researchReports.clear();
    
    // Reset counters
    mockStore.counters = {
      userId: 1,
      conversationId: 1,
      messageId: 1,
      researchJobId: 1,
      researchReportId: 1,
    };
  });

  it('should create a conversation', async () => {
    // Arrange - no additional setup needed since we're using the mock

    // Act
    const conversation = await service.createConversation(1, 'Test Conversation');

    // Assert
    expect(conversation).toBeDefined();
    expect(conversation.id).toBe(1);
    expect(conversation.userId).toBe(1);
    expect(conversation.title).toBe('Test Conversation');
    
    // Verify the mock was called
    expect(mockStorage.createConversation).toHaveBeenCalledWith({
      userId: 1,
      title: 'Test Conversation',
    });
    
    // Check the mock store directly
    expect(mockStore.conversations.size).toBe(1);
    expect(mockStore.conversations.get(1)).toBe(conversation);
  });

  it('should add a message to a conversation', async () => {
    // Arrange - create a conversation first
    const conversation = await service.createConversation(1, 'Test Conversation');

    // Act
    const message = await service.addMessage(conversation.id, 'Hello world');

    // Assert
    expect(message).toBeDefined();
    expect(message.id).toBe(1);
    expect(message.conversationId).toBe(conversation.id);
    expect(message.content).toBe('Hello world');
    expect(message.role).toBe('user');
    
    // Verify the mock was called
    expect(mockStorage.createMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      role: 'user',
      content: 'Hello world',
      service: 'system',
    });
    
    // Check the mock store directly
    expect(mockStore.messages.size).toBe(1);
    expect(mockStore.messages.get(1)).toBe(message);
  });

  it('should get a conversation with messages', async () => {
    // Arrange - create a conversation and add messages
    const conversation = await service.createConversation(1, 'Test Conversation');
    await service.addMessage(conversation.id, 'Hello');
    await service.addMessage(conversation.id, 'How are you?');
    await service.addMessage(conversation.id, 'I am fine', 'assistant');

    // Reset the mocks to verify the specific calls in this test
    vi.clearAllMocks();

    // Act
    const result = await service.getConversationWithMessages(conversation.id);

    // Assert
    expect(result).toBeDefined();
    expect(result?.conversation).toEqual(conversation);
    expect(result?.messages.length).toBe(3);
    
    // Verify content of messages
    expect(result?.messages[0].content).toBe('Hello');
    expect(result?.messages[1].content).toBe('How are you?');
    expect(result?.messages[2].content).toBe('I am fine');
    
    // Verify role of messages
    expect(result?.messages[0].role).toBe('user');
    expect(result?.messages[1].role).toBe('user');
    expect(result?.messages[2].role).toBe('assistant');
    
    // Verify the mocks were called
    expect(mockStorage.getConversation).toHaveBeenCalledWith(conversation.id);
    expect(mockStorage.getMessagesByConversation).toHaveBeenCalledWith(conversation.id);
  });

  it('should handle non-existent conversation', async () => {
    // Act
    const result = await service.getConversationWithMessages(999);

    // Assert
    expect(result).toBeNull();
    
    // Verify the mocks were called
    expect(mockStorage.getConversation).toHaveBeenCalledWith(999);
    expect(mockStorage.getMessagesByConversation).not.toHaveBeenCalled();
  });
});