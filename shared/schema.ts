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
  conversationId: z.number().nullable().optional(),
  service: z.enum(['claude', 'perplexity', 'auto']).default('auto'),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const visualizeSchema = z.object({
  data: z.any(),
  type: z.enum(['bar', 'line', 'pie', 'scatter', 'custom', 'van_westendorp', 'conjoint']).default('bar'),
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

// Research Jobs schema
export const researchJobs = pgTable("research_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  query: text("query").notNull(),
  status: text("status").notNull().default("queued"), // 'queued', 'processing', 'completed', 'failed'
  progress: integer("progress").default(0),
  jobId: text("job_id").notNull(), // Bull job ID
  options: jsonb("options"),
  result: jsonb("result"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertResearchJobSchema = createInsertSchema(researchJobs).pick({
  userId: true,
  query: true,
  jobId: true,
  options: true,
});

export type InsertResearchJob = z.infer<typeof insertResearchJobSchema>;
export type ResearchJob = typeof researchJobs.$inferSelect;

// Research Reports schema
export const researchReports = pgTable("research_reports", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  citations: jsonb("citations"),
  followUpQuestions: jsonb("follow_up_questions"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertResearchReportSchema = createInsertSchema(researchReports).pick({
  jobId: true,
  title: true,
  content: true,
  summary: true,
  citations: true,
  followUpQuestions: true,
  filePath: true,
});

export type InsertResearchReport = z.infer<typeof insertResearchReportSchema>;
export type ResearchReport = typeof researchReports.$inferSelect;
