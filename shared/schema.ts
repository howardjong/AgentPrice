/**
 * Database Schema Definition
 * 
 * This file defines the database schema using Drizzle ORM.
 * It includes tables for users, conversations, messages, research jobs, and research reports.
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  pgEnum
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// ================== Enums ==================

// Role enum for message roles
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);

// Status enum for research jobs
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

// ================== Tables ==================

// Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Conversations Table
export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Messages Table
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  role: messageRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: json('metadata')
});

// Research Jobs Table
export const researchJobs = pgTable('research_jobs', {
  id: text('id').primaryKey(),
  query: text('query').notNull(),
  status: jobStatusEnum('status').notNull().default('pending'),
  userId: text('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  metadata: json('metadata')
});

// Research Reports Table
export const researchReports = pgTable('research_reports', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: json('metadata')
});

// ================== Relations ==================

export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  researchJobs: many(researchJobs)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id]
  }),
  messages: many(messages)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  })
}));

export const researchJobsRelations = relations(researchJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [researchJobs.userId],
    references: [users.id]
  }),
  reports: many(researchReports)
}));

export const researchReportsRelations = relations(researchReports, ({ one }) => ({
  job: one(researchJobs, {
    fields: [researchReports.jobId],
    references: [researchJobs.id]
  })
}));

// ================== Schemas ==================

// User schema for validation
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Conversation schema for validation
export const insertConversationSchema = createInsertSchema(conversations).omit({
  createdAt: true,
  updatedAt: true
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Message schema for validation
export const insertMessageSchema = createInsertSchema(messages).omit({
  createdAt: true,
  metadata: true
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Research job schema for validation
export const insertResearchJobSchema = createInsertSchema(researchJobs).omit({
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  error: true,
  metadata: true
});
export type InsertResearchJob = z.infer<typeof insertResearchJobSchema>;
export type ResearchJob = typeof researchJobs.$inferSelect;

// Research report schema for validation
export const insertResearchReportSchema = createInsertSchema(researchReports).omit({
  createdAt: true,
  metadata: true
});
export type InsertResearchReport = z.infer<typeof insertResearchReportSchema>;
export type ResearchReport = typeof researchReports.$inferSelect;

// ================== Custom API Schemas ==================

// Chat message schema for API validation
export const chatMessageSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  service: z.enum(['claude', 'perplexity']).optional().default('claude')
});

// Visualization request schema
export const visualizeSchema = z.object({
  data: z.any(),
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional()
});

// Deep research request schema
export const deepResearchSchema = z.object({
  query: z.string().min(1),
  userId: z.string().optional(),
  options: z.object({
    maxDepth: z.number().optional(),
    includeSources: z.boolean().optional(),
    model: z.string().optional()
  }).optional()
});