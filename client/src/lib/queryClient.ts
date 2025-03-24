import { QueryClient } from '@tanstack/react-query';

// Custom error handler for query client
const queryErrorHandler = (error: unknown) => {
  // Log the error
  console.error('React Query error:', error);

  // Check if it's a rate limit error
  const isRateLimit = 
    error instanceof Error && 
    'status' in (error as any) && 
    (error as any).status === 429;

  if (isRateLimit) {
    console.warn('Rate limit detected in React Query, backing off...');
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry too many times for rate limit errors
        const isRateLimit = 
          error instanceof Error && 
          'status' in (error as any) && 
          (error as any).status === 429;

        if (isRateLimit && failureCount >= 2) {
          return false;
        }

        // For other errors, retry up to 2 times
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff with a base of 5 seconds
        return Math.min(1000 * Math.pow(2, attemptIndex) * 5, 30000);
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      onError: queryErrorHandler
    },
    mutations: {
      onError: queryErrorHandler,
      retry: (failureCount, error) => {
        // Special handling for rate limits
        const isRateLimit = 
          error instanceof Error && 
          'status' in (error as any) && 
          (error as any).status === 429;

        // Only retry once for rate limits
        if (isRateLimit) {
          return failureCount < 1;
        }

        return false; // Don't retry other mutation errors
      },
      retryDelay: 10000 // 10 seconds delay for mutation retries
    }
  },
});

import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Ensure error is properly formatted and handled
    console.error(`API request failed: ${method} ${url}`, error);

    // Re-throw as a properly structured error object
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unknown error in API request: ${String(error)}`);
    }
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };