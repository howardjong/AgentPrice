import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/error-boundary';

const queryClient = new QueryClient();

// Enhanced unhandled rejection handler with more detailed logging
window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Prevent the error from being silently swallowed
  event.preventDefault();
  
  // Add better error reporting
  const errorDetails = {
    message: event.reason?.message || 'Unknown error',
    stack: event.reason?.stack,
    timestamp: new Date().toISOString()
  };
  
  // Log to console in a structured way for better debugging
  console.error('Promise rejection details:', errorDetails);
  
  // Could add error reporting to server here if needed
  // fetch('/api/log-client-error', {
  //   method: 'POST', 
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(errorDetails)
  // }).catch(e => console.error('Failed to report error:', e));
};

const container = document.getElementById("root");
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}