import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const SheetEntitySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();

export const SheetsPaginationSchema = z
  .object({
    limit: NumericLike.optional(),
    offset: NumericLike.optional(),
    totalResults: NumericLike.optional(),
    returned: NumericLike.optional(),
    hasMore: z.boolean().optional(),
    nextOffset: z.union([z.number(), z.null()]).optional(),
    fetchAll: z.boolean().optional(),
    maxPages: z.number().optional(),
    maxItems: z.number().optional(),
    fetchedPages: z.number().optional(),
    fetchedItems: z.number().optional()
  })
  .passthrough();

export const SheetsProjectResolutionSchema = z.object({
  source: z.enum(["input.projectId", "input.projectName"]),
  hubId: z.string().nullable(),
  requestedProjectName: z.string().nullable(),
  resolvedProjectName: z.string().nullable(),
  rawProjectId: z.string(),
  sheetsProjectId: z.string()
});

const SheetsToolMetaSchema = z
  .object({
    projectResolution: SheetsProjectResolutionSchema.optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    schema: z
      .object({
        parser: z.string().optional(),
        warning: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export const SheetsToolResponseSchema = createMcpResponseSchema(SheetEntitySchema)
  .extend({
    pagination: SheetsPaginationSchema.optional(),
    meta: SheetsToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();
