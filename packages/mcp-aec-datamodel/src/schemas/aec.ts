import { z } from "zod";

export const AecHubsQuerySchema = z.object({
  filterQuery: z
    .string()
    .optional()
    .describe("Filtro opcional AEC para hubs (ej: name==TAD)"),
  pageSize: z.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

export const AecProjectsQuerySchema = z.object({
  hubId: z
    .string()
    .describe("ID del Hub (b.xxx Data Management o ID GraphQL AEC)"),
  filterQuery: z
    .string()
    .optional()
    .describe("Filtro opcional AEC para proyectos"),
  pageSize: z.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

export const AecElementsByProjectQuerySchema = z.object({
  projectId: z.string().describe("ID del proyecto (GraphQL)"),
  filterQuery: z.string().optional().describe("Filtro opcional AEC para elementos"),
  pageSize: z.number().int().positive().max(200).optional(),
  cursor: z.string().optional(),
});

export const AecProjectSchema = AecProjectsQuerySchema;
export const AecElementQuerySchema = z.object({
  classicHubId: z.string().describe("Hub ID en formato Data Management (b.xxx)"),
  classicProjectId: z
    .string()
    .describe("Project ID Data Management (b.xxx) o ID GraphQL"),
  category: z.string().optional().describe("Ejemplo: Revit Walls"),
});
