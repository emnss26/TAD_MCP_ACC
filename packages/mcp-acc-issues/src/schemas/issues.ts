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


export const CreateIssueSchema = z.object({
  projectId: z.string().describe("ID del proyecto (con o sin b.)"),
  title: z.string().max(100).describe("Título (máx 100 caracteres)"),
  description: z.string().max(1000).optional().describe("Descripción (máx 1000 caracteres)"),
  issueSubtypeId: z.string().uuid().describe("ID del subtipo de incidencia (obtenido de context mapping)"),
  status: z.enum([
    "draft", "open", "pending", "in_progress", "completed", 
    "in_review", "not_approved", "in_dispute", "closed"
  ]).default("open").describe("Estado inicial"),
  assignedTo: z.string().optional().describe("ID de Autodesk del usuario/empresa/rol"),
  assignedToType: z.enum(["user", "company", "role"]).optional().describe("Tipo de asignado"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato debe ser YYYY-MM-DD").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato debe ser YYYY-MM-DD").optional(),
  locationId: z.string().uuid().optional(),
  locationDetails: z.string().max(250).optional(),
  rootCauseId: z.string().uuid().optional(),
  published: z.boolean().default(false)
});