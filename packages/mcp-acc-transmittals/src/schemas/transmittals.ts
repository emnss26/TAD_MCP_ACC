import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const TransmittalSchema = z
  .object({
    id: z.string().optional(),
    number: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    dueDate: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedBy: z.string().optional(),
    updatedAt: z.string().optional(),
    distribution: z.array(z.unknown()).optional(),
    attachmentsCount: NumericLike.optional(),
    commentsCount: NumericLike.optional()
  })
  .passthrough();

export const TransmittalPaginationSchema = z
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
  transmittalsProjectId: z.string()
});

const TransmittalToolMetaSchema = z
  .object({
    projectResolution: ProjectResolutionSchema.optional(),
    options: z
      .object({
        fetchAll: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        maxPages: z.number().optional(),
        maxItems: z.number().optional()
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

export const TransmittalListResponseSchema = createMcpResponseSchema(
  TransmittalSchema
)
  .extend({
    pagination: TransmittalPaginationSchema.optional()
  })
  .passthrough();

export const TransmittalToolResponseSchema = createMcpResponseSchema(
  TransmittalSchema
)
  .extend({
    pagination: TransmittalPaginationSchema.optional(),
    meta: TransmittalToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();
