// Using CommonJS for Jest compatibility
const { jest } = require('@jest/globals');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const { RobustAPIClient } = require('../../utils/apiClient.js');

describe('RobustAPIClient', () => {
  let mock;
  let client;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new RobustAPIClient({
      maxRetries: 3,
      retryDelay: 100
    });
  });

  afterEach(() => {
    mock.reset();
  });

  test('retries on 429 status', async () => {
    mock.onGet('/test').replyOnce(429).onGet('/test').reply(200, { data: 'success' });

    const response = await client.request({
      method: 'GET',
      url: '/test'
    });

    expect(response.data).toEqual({ data: 'success' });
    expect(mock.history.get.length).toBe(2);
  });
});