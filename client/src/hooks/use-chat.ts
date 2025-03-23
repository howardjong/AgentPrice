import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
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

  // Send a chat message
  const { mutate: sendMessage, isPending: isSendingMessage } = useMutation({
    mutationFn: async ({ message, service }: { message: string, service: string }) => {
      addLog(`Sending message to ${service === 'auto' ? 'auto-detect' : service} service`);
      
      // Add the user message immediately to the UI
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now(), // Use timestamp as temporary ID
          conversationId: conversationId || 0,
          role: 'user',
          content: message,
          service: 'system',
          timestamp: new Date().toISOString(),
          visualizationData: null,
          citations: null
        } as Message
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
    apiStatus,
    isLoadingStatus,
    logs,
    getServiceChangedMessage
  };
}
