
import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RobustAPIClient } from '../../utils/apiClient.js';

describe('RobustAPIClient', () => {
  let mock;
  let client;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new RobustAPIClient({
      maxRetries: 3,
      retryDelay: 100
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    mock.reset();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('retries on 429 status', async () => {
    const endpoint = 'https://api.test.com/data';
    
    // First two calls return 429, third succeeds
    mock.onGet(endpoint)
      .replyOnce(429)
      .onGet(endpoint)
      .replyOnce(429)
      .onGet(endpoint)
      .reply(200, { data: 'success' });

    const response = await client.request({
      url: endpoint,
      method: 'GET'
    });

    expect(response.data).toEqual({ data: 'success' });
    expect(mock.history.get.length).toBe(3);
  });
});
