# Socket.IO Testing for Multi-LLM Research Workflows

This document outlines best practices and strategies for testing Socket.IO implementations in the multi-LLM research system, particularly for real-time communication during research workflows.

## Overview

Socket.IO is used in our application to:
1. Provide real-time updates during lengthy research processes
2. Stream partial results to clients while deep research is ongoing
3. Broadcast notifications about workflow state changes
4. Transmit chart data and visualization results

Testing Socket.IO implementations presents unique challenges:
- Asynchronous event-based communication
- Race conditions in test environments
- Establishing and cleaning up connections reliably
- Verifying event ordering and payload contents

## Socket.IO Test Architecture

Our Socket.IO testing approach uses a two-layer strategy:

### Layer 1: Isolated Socket Testing
Tests focused specifically on Socket.IO functionality:
- Connection establishment and authentication
- Event emission and reception
- Error handling and reconnection logic
- Broadcasting to rooms and namespaces

### Layer 2: Workflow Integration Testing
Tests that verify Socket.IO works correctly within research workflows:
- Progress updates during multi-step processes
- Error propagation via socket events
- Chart data transmission
- Status notifications at workflow boundaries

## Test Utilities

We've created several utilities to facilitate Socket.IO testing:

1. **createTestSocketClient**: Creates a client socket that connects to a test server
2. **mockSocketServer**: Simulates a Socket.IO server for client testing
3. **waitForSocketEvent**: Promise-based utility for waiting for specific events
4. **recordSocketEvents**: Records all events for later verification
5. **socketEventMatcher**: Compares socket events against expected patterns

## Best Practices for Socket.IO Testing

### 1. Proper Teardown

Always ensure sockets are properly disconnected after tests:

```javascript
afterEach(() => {
  // Disconnect all sockets
  clientSocket.disconnect();
  serverSocket.disconnect();
});
```

### 2. Wait for Connection Before Testing

Ensure connections are established before testing events:

```javascript
before(async () => {
  [clientSocket, serverSocket] = await createSocketPair();
  await waitForSocketConnection(clientSocket);
});
```

### 3. Use Promises for Event Waiting

Convert event callbacks to promises for cleaner tests:

```javascript
test('should receive research update', async () => {
  // Arrange: Set up an event promise
  const updatePromise = waitForSocketEvent(clientSocket, 'research_update');
  
  // Act: Trigger the event from server
  serverSocket.emit('research_update', { progress: 50 });
  
  // Assert: Wait for and verify the event
  const updateData = await updatePromise;
  expect(updateData).toHaveProperty('progress', 50);
});
```

### 4. Test Timeout Handling

Verify that long-running operations won't cause socket timeouts:

```javascript
test('should handle long-running research without timeout', async () => {
  // Set longer timeout for this test
  jest.setTimeout(30000);
  
  // Simulate long-running process
  const completionPromise = waitForSocketEvent(clientSocket, 'research_complete');
  
  // Start process that will take ~15 seconds
  server.startLongResearch();
  
  // Verify we get completion event without timeout
  const result = await completionPromise;
  expect(result).toHaveProperty('status', 'success');
});
```

### 5. Race Condition Mitigation

Use proper sequencing and waiting to avoid race conditions:

```javascript
test('should process events in order', async () => {
  const events = [];
  
  // Record events as they arrive
  clientSocket.on('step_complete', (data) => {
    events.push(data);
  });
  
  // Start multi-step process
  serverSocket.emit('start_workflow', { steps: 3 });
  
  // Wait for all steps to complete
  await waitForEventCount(clientSocket, 'step_complete', 3);
  
  // Verify order
  expect(events[0].step).toBe(1);
  expect(events[1].step).toBe(2);
  expect(events[2].step).toBe(3);
});
```

## Testing Real-time Workflow Progress

For the single-query workflow, we test Socket.IO integration by:

1. Monitoring workflow stage transitions
2. Verifying progress percentage updates
3. Checking intermediate results streaming
4. Confirming final research and chart data delivery

Example workflow socket test:

```javascript
test('should emit progress events during deep research', async () => {
  // Create test client and connect to workflow namespace
  const client = await createTestSocketClient('/workflow');
  
  // Start recording events
  const events = recordSocketEvents(client, ['progress', 'error', 'complete']);
  
  // Trigger workflow
  client.emit('start_research', { query: 'Climate change impacts' });
  
  // Wait for completion
  await waitForSocketEvent(client, 'complete');
  
  // Analyze progress events
  const progressEvents = events.filter(e => e.name === 'progress');
  
  // Verify we received multiple progress updates
  expect(progressEvents.length).toBeGreaterThan(3);
  
  // Verify progress increases over time
  const percentages = progressEvents.map(e => e.data.percentage);
  for (let i = 1; i < percentages.length; i++) {
    expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i-1]);
  }
  
  // Verify final progress reaches 100%
  expect(percentages[percentages.length - 1]).toBe(100);
  
  // Cleanup
  client.disconnect();
});
```

## Socket Event Schema Validation

We validate socket event payloads against defined schemas:

```javascript
const researchUpdateSchema = z.object({
  stage: z.enum(['clarifying', 'researching', 'extracting', 'visualizing']),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  timestamp: z.number()
});

test('should emit correctly structured progress events', async () => {
  // ...test setup...
  
  // Record progress events
  const progressEvent = await waitForSocketEvent(clientSocket, 'research_update');
  
  // Validate against schema
  const validationResult = researchUpdateSchema.safeParse(progressEvent);
  expect(validationResult.success).toBe(true);
});
```

## Handling Socket Reconnection Testing

Testing reconnection behavior:

```javascript
test('should resume workflow after reconnection', async () => {
  // Start workflow
  serverSocket.emit('start_research', { query: 'Example query' });
  
  // Wait for some progress
  await waitForSocketEvent(clientSocket, 'research_update');
  
  // Simulate disconnection
  await simulateTemporaryDisconnection(clientSocket);
  
  // Verify workflow continues after reconnection
  const updateAfterReconnect = await waitForSocketEvent(clientSocket, 'research_update');
  expect(updateAfterReconnect).toHaveProperty('stage');
  
  // Verify eventual completion
  const completion = await waitForSocketEvent(clientSocket, 'research_complete');
  expect(completion).toHaveProperty('status', 'success');
});
```

## Mocking Socket.IO for Unit Tests

For component unit tests that don't need a full Socket.IO server:

```javascript
// Mock socket implementation
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn()
};

// Mock io connection factory
vi.mock('socket.io-client', () => ({
  io: () => mockSocket
}));

test('component handles socket events correctly', () => {
  // Simulate receiving an event
  const handler = mockSocket.on.mock.calls.find(call => call[0] === 'research_update')[1];
  
  // Trigger the handler with test data
  handler({ progress: 75 });
  
  // Verify component updates accordingly
  expect(screen.getByRole('progressbar')).toHaveValue(75);
});
```

## Conclusion

Effective Socket.IO testing requires:
1. Careful management of connection state
2. Promise-based utilities for event synchronization
3. Thorough cleanup after tests
4. Schema validation for event payloads
5. Testing reconnection and error scenarios

By following these patterns, we ensure our real-time communication remains reliable across all workflow stages.