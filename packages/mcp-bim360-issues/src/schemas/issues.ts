import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

const ViewableSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    is3D: z.union([z.boolean(), z.string()]).optional(),
    guid: z.string().optional(),
    viewableId: z.string().optional()
  })
  .passthrough();

const PositionSchema = z
  .object({
    x: z.union([z.number(), z.string()]).optional(),
    y: z.union([z.number(), z.string()]).optional(),
    z: z.union([z.number(), z.string()]).optional()
  })
  .passthrough();

const LinkedDocumentDetailsSchema = z
  .object({
    viewable: ViewableSchema.optional(),
    position: PositionSchema.optional(),
    objectId: z.union([z.string(), z.number()]).optional(),
    externalId: z.string().optional(),
    viewerState: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

export const IssueLinkedDocumentSchema = z
  .object({
    type: z.string().optional(),
    urn: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    createdAtVersion: NumericLike.optional(),
    closedBy: z.string().optional(),
    closedAt: z.string().optional(),
    closedAtVersion: NumericLike.optional(),
    details: LinkedDocumentDetailsSchema.optional()
  })
  .passthrough();

export const IssueLinkSchema = z
  .object({
    type: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

export const IssueOfficialResponseSchema = z
  .object({
    response: z.string().optional(),
    respondedAt: z.string().optional(),
    respondedBy: z.string().optional()
  })
  .passthrough();

export const IssueCustomAttributeSchema = z
  .object({
    attributeDefinitionId: z.string().optional(),
    value: z.unknown().optional(),
    type: z.string().optional(),
    title: z.string().optional()
  })
  .passthrough();

export const IssueSchema = z
  .object({
    id: z.string().optional(),
    containerId: z.string().optional(),
    displayId: NumericLike.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    snapshotUrn: z.string().optional(),
    snapshotWipUrn: z.string().optional(),
    issueTypeId: z.string().optional(),
    issueSubtypeId: z.string().optional(),
    status: z.string().optional(),
    assignedTo: z.string().optional(),
    assignedToType: z.enum(["user", "company", "role"]).optional(),
    dueDate: z.string().optional(),
    locationId: z.string().optional(),
    locationDetails: z.string().optional(),
    linkedDocuments: z.array(IssueLinkedDocumentSchema).optional(),
    links: z.array(IssueLinkSchema).optional(),
    ownerId: z.string().optional(),
    rootCauseId: z.string().optional(),
    officialResponse: IssueOfficialResponseSchema.optional(),
    issueTemplateId: z.string().optional(),
    permittedStatuses: z.array(z.string()).optional(),
    permittedAttributes: z.array(z.string()).optional(),
    permittedActions: z.record(z.string(), z.unknown()).optional(),
    commentCount: NumericLike.optional(),
    attachmentCount: NumericLike.optional(),
    openedBy: z.string().optional(),
    openedAt: z.string().optional(),
    closedBy: z.string().optional(),
    closedAt: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedBy: z.string().optional(),
    updatedAt: z.string().optional(),
    clientCreatedAt: z.string().optional(),
    clientUpdatedAt: z.string().optional(),
    customAttributes: z.array(IssueCustomAttributeSchema).optional()
  })
  .passthrough();

export const IssueResponsePaginationSchema = z
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
  issuesProjectId: z.string()
});

const IssueToolMetaSchema = z
  .object({
    projectResolution: ProjectResolutionSchema.optional(),
    schema: z
      .object({
        parser: z.string().optional(),
        warning: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export const IssueListResponseSchema = createMcpResponseSchema(IssueSchema)
  .extend({
    pagination: IssueResponsePaginationSchema.optional()
  })
  .passthrough();

export const IssueToolResponseSchema = createMcpResponseSchema(IssueSchema)
  .extend({
    pagination: IssueResponsePaginationSchema.optional(),
    meta: IssueToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();

// Backward compatibility for current imports.
export const Issue = IssueSchema;
export const IssueListResponse = IssueListResponseSchema;

const Iso8601DateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Fecha invalida. Usa formato ISO 8601."
  });

const IssueCustomAttributeInputSchema = z
  .object({
    attributeDefinitionId: z.string().min(1),
    value: z.union([z.string(), z.number(), z.null()])
  })
  .passthrough();

const IssueGpsCoordinatesInputSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const CreateIssueSchema = z
  .object({
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
    projectId: z
      .string()
      .optional()
      .describe("Project ID directo (con o sin b.)."),
    projectName: z
      .string()
      .optional()
      .describe("Nombre del proyecto para resolver projectId usando hub."),
    region: z
      .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
      .optional()
      .describe("Header x-ads-region opcional."),
    title: z.string().min(1).max(10000).describe("Titulo del issue."),
    description: z
      .string()
      .max(10000)
      .optional()
      .describe("Descripcion (max 10000 caracteres)."),
    snapshotUrn: z.string().optional(),
    issueSubtypeId: z
      .string()
      .min(1)
      .describe("ID del subtipo de issue."),
    status: z
      .enum([
        "draft",
        "open",
        "pending",
        "in_progress",
        "in_review",
        "completed",
        "not_approved",
        "in_dispute",
        "closed"
      ])
      .describe("Estado inicial del issue."),
    assignedTo: z
      .string()
      .optional()
      .describe("Autodesk ID del usuario/empresa/rol asignado."),
    assignedToType: z
      .enum(["user", "company", "role"])
      .optional()
      .describe("Tipo del assignee."),
    dueDate: Iso8601DateSchema.optional(),
    startDate: Iso8601DateSchema.optional(),
    locationId: z.string().optional(),
    locationDetails: z
      .string()
      .max(8300)
      .optional()
      .describe("Texto libre de ubicacion."),
    rootCauseId: z.string().optional(),
    issueTemplateId: z.string().optional(),
    published: z
      .boolean()
      .optional()
      .describe("Si se publica inmediatamente."),
    watchers: z.array(z.string()).optional(),
    customAttributes: z.array(IssueCustomAttributeInputSchema).optional(),
    gpsCoordinates: IssueGpsCoordinatesInputSchema.optional(),
    additionalPayload: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Payload adicional para campos no modelados.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  })
  .refine(
    (value) =>
      (Boolean(value.assignedTo) && Boolean(value.assignedToType)) ||
      (!value.assignedTo && !value.assignedToType),
    {
      message: "assignedTo y assignedToType deben enviarse juntos.",
      path: ["assignedTo"]
    }
  );
