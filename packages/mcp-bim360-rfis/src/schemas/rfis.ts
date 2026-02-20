import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const RfiSchema = z
  .object({
    id: z.string().optional(),
    customIdentifier: z.string().optional(),
    title: z.string().optional(),
    question: z.string().optional(),
    status: z.string().optional(),
    assignedTo: z.string().optional(),
    managerId: z.string().optional(),
    constructionManagerId: z.string().optional(),
    architectId: z.string().optional(),
    reviewerId: z.string().optional(),
    assignedToType: z.string().optional(),
    dueDate: z.string().optional(),
    location: z
      .object({
        description: z.string().optional()
      })
      .passthrough()
      .optional(),
    officialResponse: z.string().optional(),
    respondedAt: z.string().optional(),
    respondedBy: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedBy: z.string().optional(),
    updatedAt: z.string().optional(),
    closedAt: z.string().optional(),
    closedBy: z.string().optional(),
    containerId: z.string().optional(),
    projectId: z.string().optional(),
    coReviewers: z.array(z.string()).optional(),
    distributionList: z.array(z.string()).optional(),
    answeredAt: z.string().optional(),
    answeredBy: z.string().optional(),
    costImpact: z.string().optional(),
    scheduleImpact: z.string().optional(),
    priority: z.string().optional(),
    discipline: z.array(z.string()).optional(),
    category: z.array(z.string()).optional(),
    reference: z.string().optional()
  })
  .passthrough();

export const RfiPaginationSchema = z
  .object({
    limit: NumericLike.optional(),
    offset: NumericLike.optional(),
    totalResults: NumericLike.optional(),
    fetchAll: z.boolean().optional(),
    maxPages: z.number().optional(),
    maxItems: z.number().optional(),
    fetchedPages: z.number().optional(),
    fetchedItems: z.number().optional(),
    hasMore: z.boolean().optional(),
    nextOffset: z.union([z.number(), z.null()]).optional()
  })
  .passthrough();

export const RfiTypeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional()
  })
  .passthrough();

export const RfiAttributeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    type: z.string().optional()
  })
  .passthrough();

export const ProjectResolutionSchema = z.object({
  source: z.enum(["input.projectId", "input.projectName"]),
  hubId: z.string().nullable(),
  requestedProjectName: z.string().nullable(),
  resolvedProjectName: z.string().nullable(),
  rawProjectId: z.string(),
  rfisProjectId: z.string()
});

const RfiContextSchema = z
  .object({
    users: z.array(z.record(z.string(), z.unknown())).optional(),
    companies: z.array(z.record(z.string(), z.unknown())).optional(),
    rfiTypes: z.array(RfiTypeSchema).optional(),
    attributes: z.array(RfiAttributeSchema).optional()
  })
  .optional();

const RfiDictionariesSchema = z
  .object({
    usersById: z.record(z.string(), z.unknown()).optional(),
    companiesById: z.record(z.string(), z.unknown()).optional(),
    rfiTypesById: z.record(z.string(), z.unknown()).optional()
  })
  .optional();

const RfiToolMetaSchema = z
  .object({
    projectResolution: ProjectResolutionSchema.optional(),
    context: RfiContextSchema,
    dictionaries: RfiDictionariesSchema,
    options: z
      .object({
        includeContext: z.boolean().optional(),
        includeDictionaries: z.boolean().optional()
      })
      .optional(),
    schema: z
      .object({
        parser: z.string().optional(),
        warning: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export const RfiListResponseSchema = createMcpResponseSchema(RfiSchema)
  .extend({
    pagination: RfiPaginationSchema.optional()
  })
  .passthrough();

export const RfiToolResponseSchema = createMcpResponseSchema(RfiSchema)
  .extend({
    pagination: RfiPaginationSchema.optional(),
    meta: RfiToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();

const RfiCustomAttributeInputSchema = z.object({
  id: z.string().min(1),
  values: z.array(z.string()).default([])
});

const Iso8601DateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Fecha invalida. Usa formato ISO 8601."
  });

export const CreateRfiInputSchema = z
  .object({
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
    projectId: z
      .string()
      .min(3)
      .optional()
      .describe("Project ID directo (con o sin prefijo b.)."),
    projectName: z
      .string()
      .min(2)
      .optional()
      .describe("Nombre del proyecto para resolver el projectId usando el hub."),
    region: z
      .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
      .optional()
      .describe("Region opcional para enrutar la peticion."),
    title: z.string().min(3).max(255).describe("Titulo del RFI."),
    question: z.string().min(3).describe("Pregunta del RFI."),
    status: z
      .enum(["draft", "open", "answered", "closed"])
      .default("draft")
      .describe("Estado inicial del RFI."),
    suggestedAnswer: z.string().optional(),
    dueDate: Iso8601DateSchema
      .optional()
      .describe("Fecha ISO 8601, por ejemplo 2025-07-31T09:35:54.000Z."),
    rfiTypeId: z.string().optional().describe("ID del tipo de RFI."),
    customIdentifier: z.string().optional(),
    customAttributes: z.array(RfiCustomAttributeInputSchema).optional(),
    additionalPayload: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Payload adicional para campos no modelados.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });
