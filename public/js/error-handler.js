
/**
 * Global error handler for client-side promise rejections
 */

// Set up global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in client:', event);
  
  // Log more detailed information about the rejection
  console.error('Unhandled promise rejection:', event.reason);
  
  // Log structured details for better debugging
  console.error('Promise rejection details:', {
    message: event.reason?.message || 'Unknown error',
    stack: event.reason?.stack || 'No stack trace',
    timestamp: new Date().toISOString()
  });
  
  // Send to server error logging endpoint if available
  try {
    fetch('/api/log-client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: event.reason?.message || 'Unknown error',
        stack: event.reason?.stack || 'No stack trace',
        timestamp: new Date().toISOString(),
        url: window.location.href
      })
    }).catch(err => {
      // Silently handle fetch errors to avoid recursive rejections
      console.error('Failed to send error to server:', err);
    });
  } catch (e) {
    // Fallback if even the error logging fails
    console.error('Error in error handler:', e);
  }
});
