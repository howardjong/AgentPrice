import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema (keeping the original schema)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Conversation schema
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  title: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Message schema
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  service: text("service").notNull(), // 'claude', 'perplexity', 'system'
  visualizationData: jsonb("visualization_data"), // Optional for when Claude generates visualization
  citations: jsonb("citations"), // Optional for when Perplexity provides citations
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  service: true,
  visualizationData: true,
  citations: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// API Status Schema for TypeScript
export interface ServiceStatus {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastUsed: string | null;
  version: string;
  error?: string;
}

export interface ApiStatus {
  claude: ServiceStatus;
  perplexity: ServiceStatus;
  server: {
    status: 'running' | 'error';
    load: number;
    uptime: string;
    error?: string;
  };
}

// API Endpoint types
export const chatMessageSchema = z.object({
  message: z.string(),
  conversationId: z.number().optional(),
  service: z.enum(['claude', 'perplexity', 'auto']).default('auto'),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const visualizeSchema = z.object({
  data: z.any(),
  type: z.enum(['bar', 'line', 'pie', 'scatter', 'custom']).default('bar'),
  title: z.string().optional(),
  description: z.string().optional(),
});

export type VisualizeRequest = z.infer<typeof visualizeSchema>;

export const deepResearchSchema = z.object({
  query: z.string().min(5, "Query must be at least 5 characters long"),
  conversationId: z.number().optional(),
  options: z.object({
    depth: z.enum(['shallow', 'medium', 'deep']).default('deep'),
    maxSourceCount: z.number().optional(),
    recencyFilter: z.string().optional()
  }).optional()
});

export type DeepResearchRequest = z.infer<typeof deepResearchSchema>;
