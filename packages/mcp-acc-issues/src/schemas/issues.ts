import { z } from "zod";

// Esquema mínimo (no te amarres de manos; ACC trae campos enormes)
export const Issue = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
}).passthrough();

export const IssueListResponse = z.object({
  results: z.array(Issue).optional()
}).passthrough();