import { jest } from '@jest/globals';
import logger from '../../utils/logger.js';

describe('Logger', () => {
  let consoleOutput = [];
  const mockConsole = {
    log: (msg) => consoleOutput.push(msg),
  };

  beforeEach(() => {
    consoleOutput = [];
    console.log = jest.fn(mockConsole.log);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs messages with correct level and format', () => {
    const testMessage = 'Test log message';
    logger.info(testMessage);

    expect(consoleOutput.length).toBe(1);
    const logOutput = JSON.parse(consoleOutput[0]);
    expect(logOutput).toMatchObject({
      level: 'info',
      message: testMessage,
      service: 'multi-llm-research'
    });
  });

  test('adds trace ID to log messages', () => {
    const testMessage = 'Test with trace';
    const testTraceId = '123-test-trace';

    const namespace = require('cls-hooked').createNamespace('research-system');
    namespace.run(() => {
      namespace.set('traceId', testTraceId);
      logger.info(testMessage);
    });

    const logOutput = JSON.parse(consoleOutput[0]);
    expect(logOutput.traceId).toBe(testTraceId);
  });

  test('logs messages with trace ID', () => {
    const mockInfo = jest.spyOn(logger, 'info');

    logger.info('Test message', { data: 'test' });

    expect(mockInfo).toHaveBeenCalledWith('Test message', {
      data: 'test',
      traceId: 'no-trace'
    });
  });
});