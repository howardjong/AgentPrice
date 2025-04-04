import React from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date | string;
  service?: "claude" | "perplexity" | "system";
  visualizationData?: any;
  citations?: string[];
}

export function ChatMessage({ role, content, timestamp, service, visualizationData, citations }: ChatMessageProps) {
  // Safely format the timestamp
  let formattedTime = "";
  try {
    // Convert string timestamps to Date objects if needed
    const dateTimestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);
    formattedTime = format(dateTimestamp, "h:mm a");
  } catch (error) {
    console.warn("Invalid timestamp format:", timestamp);
    formattedTime = "just now"; // Fallback text
  }

  if (role === "system") {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-600">
          <i className="ri-refresh-line mr-1"></i> {content}
        </div>
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="flex mb-4">
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center mr-2">
          <i className="ri-user-line text-gray-600"></i>
        </div>
        <div className="max-w-3xl">
          <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm">
            <p>{content}</p>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <span>{formattedTime}</span>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  const bgColor = service === "claude" ? "bg-primary/5 border border-primary/10" : "bg-secondary/5 border border-secondary/10";
  const iconBgColor = service === "claude" ? "bg-primary/20" : "bg-secondary/20";
  const textColor = service === "claude" ? "text-primary" : "text-secondary";
  const icon = service === "claude" ? "ri-chat-3-line" : "ri-search-line";

  return (
    <div className="flex mb-4 justify-end">
      <div className="max-w-3xl">
        <div className={`${bgColor} rounded-lg px-4 py-2 text-sm`}>
          <div className="flex items-center mb-2">
            <div className={`w-5 h-5 rounded-full ${iconBgColor} flex items-center justify-center mr-2`}>
              <i className={`${icon} ${textColor} text-xs`}></i>
            </div>
            <span className={`text-xs font-medium ${textColor}`}>{service === "claude" ? "Claude" : "Perplexity"}</span>
          </div>
          <p>{content}</p>
          
          {visualizationData && (
            <div className="mt-3 bg-white p-3 rounded border border-gray-200">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={visualizationData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4F46E5" />
                </BarChart>
              </ResponsiveContainer>
              {visualizationData.title && (
                <p className="text-center text-xs font-medium mt-3">{visualizationData.title}</p>
              )}
            </div>
          )}
          
          {citations && citations.length > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-medium">Sources:</span> 
              {citations.map((citation, index) => (
                <span key={index} className={`underline ${textColor}/80 ml-1`}>
                  {new URL(citation).hostname}
                  {index < citations.length - 1 && ", "}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 text-xs text-gray-500 text-right">
          <span>{formattedTime}</span>
        </div>
      </div>
      <div className={`w-9 h-9 rounded-full ${service === "claude" ? "bg-primary/10" : "bg-secondary/10"} flex items-center justify-center ml-2`}>
        <i className={`${icon} ${textColor}`}></i>
      </div>
    </div>
  );
}
