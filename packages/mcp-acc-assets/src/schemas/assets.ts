import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const AssetSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    assetCategoryId: z.string().optional(),
    categoryId: z.string().optional(),
    statusStepSetId: z.string().optional(),
    assetStatusId: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    updatedBy: z.string().optional(),
    updatedAt: z.string().optional(),
    assignedTo: z.string().optional(),
    assignedToType: z.string().optional(),
    customAttributes: z.array(z.record(z.string(), z.unknown())).optional()
  })
  .passthrough();

const AssetContextEntitySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();

export const AssetPaginationSchema = z
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
  assetsProjectId: z.string()
});

const AssetContextSchema = z
  .object({
    users: z.array(z.record(z.string(), z.unknown())).optional(),
    companies: z.array(z.record(z.string(), z.unknown())).optional(),
    categories: z.array(AssetContextEntitySchema).optional(),
    statusStepSets: z.array(AssetContextEntitySchema).optional(),
    assetStatuses: z.array(AssetContextEntitySchema).optional(),
    customAttributes: z.array(AssetContextEntitySchema).optional()
  })
  .optional();

const AssetDictionariesSchema = z
  .object({
    usersById: z.record(z.string(), z.unknown()).optional(),
    companiesById: z.record(z.string(), z.unknown()).optional(),
    categoriesById: z.record(z.string(), z.unknown()).optional(),
    statusStepSetsById: z.record(z.string(), z.unknown()).optional(),
    assetStatusesById: z.record(z.string(), z.unknown()).optional(),
    customAttributesById: z.record(z.string(), z.unknown()).optional()
  })
  .optional();

const AssetToolMetaSchema = z
  .object({
    projectResolution: ProjectResolutionSchema.optional(),
    context: AssetContextSchema,
    dictionaries: AssetDictionariesSchema,
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

export const AssetListResponseSchema = createMcpResponseSchema(AssetSchema)
  .extend({
    pagination: AssetPaginationSchema.optional()
  })
  .passthrough();

export const AssetToolResponseSchema = createMcpResponseSchema(AssetSchema)
  .extend({
    pagination: AssetPaginationSchema.optional(),
    meta: AssetToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();
