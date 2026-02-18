import { z } from "zod";

const ListOutputSchema = {
  limit: z.number().int().min(1).max(50).default(10),
  view: z.enum(["summary", "page", "full"]).default("page"),
  outputFields: z.array(z.string().min(1)).optional(),
};

export const AecHubsQuerySchema = z.object({
  filterQuery: z
    .string()
    .optional()
    .describe("Filtro opcional AEC para hubs (ej: name==TAD)"),
  pageSize: z.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
  ...ListOutputSchema,
});

export const AecProjectsQuerySchema = z.object({
  hubId: z
    .string()
    .optional()
    .describe("ID del Hub (b.xxx Data Management o ID GraphQL AEC). Si se omite, usa APS_HUB_AEC_ID (o APS_HUB_ID)."),
  filterQuery: z
    .string()
    .optional()
    .describe("Filtro opcional AEC para proyectos"),
  pageSize: z.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
  ...ListOutputSchema,
});

export const AecElementsByProjectQuerySchema = z.object({
  projectId: z.string().describe("ID del proyecto (GraphQL)"),
  filterQuery: z.string().optional().describe("Filtro opcional AEC para elementos"),
  pageSize: z.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
  ...ListOutputSchema,
});

export const AecProjectSchema = AecProjectsQuerySchema;
export const AecElementQuerySchema = z.object({
  classicHubId: z
    .string()
    .optional()
    .describe("Hub ID en formato Data Management (b.xxx). Si se omite, usa APS_HUB_AEC_ID (o APS_HUB_ID)."),
  classicProjectId: z
    .string()
    .describe("Project ID Data Management (b.xxx) o ID GraphQL"),
  category: z.string().optional().describe("Ejemplo: Revit Walls"),
  pageSize: z.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
  ...ListOutputSchema,
});
