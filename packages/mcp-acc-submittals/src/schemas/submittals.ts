import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const SubmittalSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    customIdentifier: z.string().optional(),
    itemTypeId: z.string().optional(),
    responseId: z.string().optional(),
    specId: z.string().optional(),
    dueDate: z.string().optional(),
    manager: z.string().optional(),
    managerType: z.string().optional(),
    assignedTo: z.string().optional(),
    assignedToType: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedBy: z.string().optional(),
    updatedAt: z.string().optional(),
    attachmentsCount: NumericLike.optional(),
    commentsCount: NumericLike.optional()
  })
  .passthrough();

const SubmittalContextEntitySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    identifier: z.string().optional()
  })
  .passthrough();

export const SubmittalPaginationSchema = z
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

export const ProjectResolutionSchema = z.object({
  source: z.enum(["input.projectId", "input.projectName"]),
  hubId: z.string().nullable(),
  requestedProjectName: z.string().nullable(),
  resolvedProjectName: z.string().nullable(),
  rawProjectId: z.string(),
  submittalsProjectId: z.string()
});

const SubmittalContextSchema = z
  .object({
    users: z.array(z.record(z.string(), z.unknown())).optional(),
    companies: z.array(z.record(z.string(), z.unknown())).optional(),
    itemTypes: z.array(SubmittalContextEntitySchema).optional(),
    responses: z.array(SubmittalContextEntitySchema).optional(),
    specs: z.array(SubmittalContextEntitySchema).optional()
  })
  .optional();

const SubmittalDictionariesSchema = z
  .object({
    usersById: z.record(z.string(), z.unknown()).optional(),
    companiesById: z.record(z.string(), z.unknown()).optional(),
    itemTypesById: z.record(z.string(), z.unknown()).optional(),
    responsesById: z.record(z.string(), z.unknown()).optional(),
    specsById: z.record(z.string(), z.unknown()).optional()
  })
  .optional();

const SubmittalToolMetaSchema = z
  .object({
    projectResolution: ProjectResolutionSchema.optional(),
    context: SubmittalContextSchema,
    dictionaries: SubmittalDictionariesSchema,
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

export const SubmittalListResponseSchema = createMcpResponseSchema(SubmittalSchema)
  .extend({
    pagination: SubmittalPaginationSchema.optional()
  })
  .passthrough();

export const SubmittalToolResponseSchema = createMcpResponseSchema(SubmittalSchema)
  .extend({
    pagination: SubmittalPaginationSchema.optional(),
    meta: SubmittalToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();

export const TransitionSubmittalInputSchema = z
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
    itemId: z.string().min(2).describe("ID del submittal item a transicionar."),
    stateId: z.string().min(2).describe("Estado destino (ej: mgr-1, rev, sbc-2)."),
    manager: z.string().optional().describe("Usuario manager cuando aplique al estado."),
    managerType: z
      .string()
      .optional()
      .describe("Tipo de manager cuando aplique (ej: 1)."),
    duplicateAttachments: z
      .array(z.string())
      .optional()
      .describe("IDs de adjuntos a duplicar en la transicion."),
    responseComment: z
      .string()
      .optional()
      .describe("Comentario de respuesta, usado en ciertos estados."),
    responseId: z
      .string()
      .optional()
      .describe("ID de response, usado en ciertos estados."),
    additionalPayload: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Payload adicional para compatibilidad con futuros cambios del API.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

export const CreateSubmittalInputSchema = z
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
    payload: z
      .record(z.string(), z.unknown())
      .describe("Payload exacto para POST /construction/submittals/v2/projects/:projectId/items.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });
