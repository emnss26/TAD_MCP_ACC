import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const FileFolderPermissionSchema = z
  .object({
    id: z.string().optional(),
    subjectId: z.string().optional(),
    subjectType: z.string().optional(),
    actions: z.array(z.string()).optional(),
    inherited: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
  })
  .passthrough();

export const FilesPaginationSchema = z
  .object({
    limit: NumericLike.optional(),
    offset: NumericLike.optional(),
    totalResults: NumericLike.optional(),
    returned: NumericLike.optional(),
    hasMore: z.boolean().optional(),
    nextOffset: z.union([z.number(), z.null()]).optional()
  })
  .passthrough();

export const FilesProjectResolutionSchema = z.object({
  source: z.enum(["input.projectId", "input.projectName"]),
  hubId: z.string().nullable(),
  requestedProjectName: z.string().nullable(),
  resolvedProjectName: z.string().nullable(),
  rawProjectId: z.string(),
  filesProjectIdWithB: z.string(),
  filesProjectIdWithoutB: z.string()
});

export const FilesFolderResolutionSchema = z.object({
  source: z.enum(["input.folderId", "input.folderName.exact", "input.folderName.partial"]),
  folderId: z.string(),
  folderName: z.string().nullable(),
  folderPath: z.string().nullable(),
  scannedFolders: z.number().optional(),
  scannedTopFolders: z.number().optional()
});

const FilesToolMetaSchema = z
  .object({
    projectResolution: FilesProjectResolutionSchema.optional(),
    folderResolution: FilesFolderResolutionSchema.optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    dictionaries: z.record(z.string(), z.unknown()).optional(),
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

export const FilesPermissionsListResponseSchema = createMcpResponseSchema(
  FileFolderPermissionSchema
)
  .extend({
    pagination: FilesPaginationSchema.optional()
  })
  .passthrough();

export const FilesPermissionsToolResponseSchema = createMcpResponseSchema(
  FileFolderPermissionSchema
)
  .extend({
    pagination: FilesPaginationSchema.optional(),
    meta: FilesToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();

export const FilesFolderPermissionsInputSchema = z
  .object({
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para resolver projectName o topFolders. Si se omite, usa APS_HUB_ID."),
    projectId: z
      .string()
      .optional()
      .describe("Project ID directo (con o sin b.)."),
    projectName: z
      .string()
      .optional()
      .describe("Nombre de proyecto para resolver projectId desde hub."),
    folderId: z
      .string()
      .optional()
      .describe("Folder ID directo (urn:adsk.wipprod:fs.folder:co....)."),
    folderName: z
      .string()
      .optional()
      .describe("Nombre de carpeta a buscar recursivamente desde topFolders."),
    maxFoldersScan: z
      .number()
      .int()
      .min(1)
      .max(20000)
      .default(5000)
      .describe("Limite de carpetas a recorrer durante la busqueda recursiva."),
    includeContext: z
      .boolean()
      .default(true)
      .describe("Incluye usuarios y companias de proyecto para mapear sujetos."),
    includeDictionaries: z
      .boolean()
      .default(true)
      .describe("Incluye diccionarios de ayuda (usuarios, companias, roles).")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName.",
    path: ["projectId"]
  })
  .refine((value) => Boolean(value.folderId || value.folderName), {
    message: "Debes enviar folderId o folderName.",
    path: ["folderId"]
  });
