import React, { useState } from "react";
import { ChatMessage } from "./chat-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SwitchTransition } from "@/components/ui/switch-transition";
import { Message } from "@shared/schema";
import { useChat } from "@/hooks/use-chat";

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string, service: string) => Promise<void>;
  isLoading: boolean;
}

export function ChatInterface({ messages, onSendMessage, isLoading }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedService, setSelectedService] = useState("auto");
  const { getServiceChangedMessage } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      await onSendMessage(inputValue, selectedService);
      setInputValue("");
    }
  };

  // Transform the messages to include service switching indicators
  const processedMessages = React.useMemo(() => {
    const result: (Message | { id: string; role: "system"; content: string; createdAt: string; service: "system" })[] = [];
    let lastService: string | null = null;

    messages.forEach((message, index) => {
      // Only check for service changes on assistant messages
      if (message.role === "assistant" && lastService && message.service !== lastService) {
        result.push({
          id: `system-${index}`,
          role: "system",
          content: getServiceChangedMessage(message.service as any),
          createdAt: new Date().toISOString(),
          service: "system"
        });
      }

      result.push(message);
      
      if (message.role === "assistant") {
        lastService = message.service;
      }
    });

    return result;
  }, [messages, getServiceChangedMessage]);

  return (
    <Card className="lg:col-span-2 bg-white rounded-lg shadow">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-medium text-gray-900">Conversation Testing</CardTitle>
        <CardDescription>Test interactions with Claude and Perplexity APIs</CardDescription>
      </CardHeader>
      
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Service:</span>
          
          <RadioGroup
            value={selectedService}
            onValueChange={setSelectedService}
            className="flex items-center space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="claude" id="claude" />
              <Label htmlFor="claude" className="text-sm text-gray-700">Claude (Conversation)</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="perplexity" id="perplexity" />
              <Label htmlFor="perplexity" className="text-sm text-gray-700">Perplexity (Web Research)</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="auto" id="auto" />
              <Label htmlFor="auto" className="text-sm text-gray-700">Auto-Detect</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
      
      <CardContent className="px-4 py-4 h-64 sm:px-6 overflow-y-auto">
        {processedMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>Start a conversation to test the chatbot services</p>
          </div>
        ) : (
          processedMessages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role as any}
              content={message.content}
              timestamp={message.createdAt || new Date().toISOString()}
              service={message.service as any}
              visualizationData={message.visualizationData}
              citations={message.citations}
            />
          ))
        )}
        
        <SwitchTransition show={isLoading}>
          <div className="flex mb-4 justify-end animate-pulse">
            <div className="max-w-3xl">
              <div className={`bg-gray-100 border border-gray-200 rounded-lg px-4 py-4 text-sm flex items-center space-x-2`}>
                <div className="w-3 h-3 bg-gray-300 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-gray-300 rounded-full animate-bounce delay-150"></div>
                <div className="w-3 h-3 bg-gray-300 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center ml-2">
              <i className="ri-robot-line text-gray-400"></i>
            </div>
          </div>
        </SwitchTransition>
      </CardContent>
      
      <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
        <form className="flex space-x-3" onSubmit={handleSubmit}>
          <div className="flex-grow relative rounded-md shadow-sm">
            <Input
              type="text"
              className="focus:ring-primary focus:border-primary block w-full pl-3 pr-10 py-2 sm:text-sm border-gray-300 rounded-md"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button type="button" className="text-gray-400 hover:text-gray-500">
                <i className="ri-attachment-2 text-lg"></i>
              </button>
            </div>
          </div>
          <Button 
            type="submit" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            disabled={isLoading || !inputValue.trim()}
          >
            <i className="ri-send-plane-fill mr-1"></i> Send
          </Button>
        </form>
      </div>
    </Card>
  );
}
