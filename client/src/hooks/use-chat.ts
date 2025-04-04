import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch API status
  const { data: apiStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['/api/status'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Add a log entry with timestamp
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Start a deep research query
  const { mutate: startDeepResearch, isPending: isStartingDeepResearch } = useMutation({
    mutationFn: async ({ query, options }: { query: string, options?: any }) => {
      addLog(`Starting deep research: "${query}"`);
      
      // Add the user message immediately to the UI
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now().toString(),
          conversationId: conversationId || null,
          role: 'user',
          content: query,
          service: 'system',
          createdAt: new Date().toISOString(),
          visualizationData: null,
          citations: null
        } as unknown as Message
      ]);
      
      // Add a system message indicating research has started
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: `system-${Date.now()}`,
          conversationId: conversationId || null,
          role: 'system',
          content: `Deep research task started for query: "${query}". This may take 15-30 minutes. You will be notified when results are available.`,
          service: 'system',
          createdAt: new Date().toISOString(),
          visualizationData: null,
          citations: null
        } as unknown as Message
      ]);
      
      const response = await apiRequest('POST', '/api/deep-research', { 
        query, 
        conversationId, 
        options 
      });
      return response.json();
    },
    onSuccess: (data) => {
      addLog(`Deep research job started: ${data.jobId}`);
      setConversationId(data.conversationId);
      
      // Start polling for job status
      // Note: In a real app, you would use WebSockets for real-time updates
      toast({
        title: "Deep Research Started",
        description: `Your research query has been queued. Job ID: ${data.jobId}`,
      });
    },
    onError: (error) => {
      addLog(`Error starting deep research: ${error.message}`);
      toast({
        title: "Error starting deep research",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Send a chat message
  const { mutate: sendMessage, isPending: isSendingMessage } = useMutation({
    mutationFn: async ({ message, service, deepResearch }: { message: string, service: string, deepResearch?: boolean }) => {
      if (deepResearch) {
        // If deep research is enabled, use the deep research endpoint instead
        return startDeepResearch({ query: message });
      }
      
      addLog(`Sending message to ${service === 'auto' ? 'auto-detect' : service} service`);
      
      // Add the user message immediately to the UI
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now().toString(), // Use timestamp as string ID
          conversationId: conversationId || null,
          role: 'user',
          content: message,
          service: 'system',
          createdAt: new Date().toISOString(), // Use ISO string timestamp for consistency
          visualizationData: null,
          citations: null
        } as unknown as Message
      ]);
      
      const response = await apiRequest('POST', '/api/chat', { message, service, conversationId });
      return response.json();
    },
    onSuccess: (data) => {
      addLog(`Received response from ${data.service} service`);
      setConversationId(data.conversation.id);
      
      // Only add the assistant response since the user message is handled when sending
      setMessages(prevMessages => [
        ...prevMessages,
        data.message
      ]);
      
      // Invalidate the API status to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    },
    onError: (error) => {
      addLog(`Error: ${error.message}`);
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Generate a visualization
  const { mutate: generateVisualization, isPending: isGeneratingViz } = useMutation({
    mutationFn: async (data: { data: any, type: string, title?: string, description?: string }) => {
      addLog(`Generating ${data.type} visualization via Claude`);
      const response = await apiRequest('POST', '/api/visualize', data);
      return response.json();
    },
    onSuccess: (data) => {
      addLog('Visualization generated successfully');
      toast({
        title: "Visualization created",
        description: "Claude has generated a data visualization"
      });
    },
    onError: (error) => {
      addLog(`Error generating visualization: ${error.message}`);
      toast({
        title: "Error creating visualization",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Get service changed message
  const getServiceChangedMessage = useCallback((service: 'claude' | 'perplexity') => {
    return service === 'claude' 
      ? 'Using Claude for conversation' 
      : 'Switching to Perplexity for web research';
  }, []);

  // Add initial log on component mount
  useEffect(() => {
    addLog('ChatBot Service initialized');
  }, [addLog]);

  return {
    messages,
    sendMessage,
    isSendingMessage,
    generateVisualization,
    isGeneratingViz,
    startDeepResearch,
    isStartingDeepResearch,
    apiStatus,
    isLoadingStatus,
    logs,
    getServiceChangedMessage
  };
}
