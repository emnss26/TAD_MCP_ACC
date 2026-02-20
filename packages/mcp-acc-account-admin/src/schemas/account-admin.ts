import { z } from "zod";
import { McpWarningSchema, createMcpResponseSchema } from "@tad/shared";

const NumericLike = z.union([z.number(), z.string()]);

export const AccountAdminEntitySchema = z
  .object({
    id: z.string().optional(),
    accountId: z.string().optional(),
    account_id: z.string().optional(),
    projectId: z.string().optional(),
    project_id: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    email: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();

export const AccountAdminPaginationSchema = z
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

export const AccountResolutionSchema = z.object({
  source: z.enum([
    "input.accountId",
    "input.hubId",
    "env.APS_ACCOUNT_ID",
    "env.APS_HUB_ID"
  ]),
  rawValue: z.string(),
  accountId: z.string()
});

export const ProjectResolutionSchema = z.object({
  source: z.enum(["input.projectId", "input.projectName"]),
  hubId: z.string().nullable(),
  requestedProjectName: z.string().nullable(),
  resolvedProjectName: z.string().nullable(),
  rawProjectId: z.string(),
  accountAdminProjectId: z.string()
});

const AccountAdminToolMetaSchema = z
  .object({
    accountResolution: AccountResolutionSchema.optional(),
    projectResolution: ProjectResolutionSchema.optional(),
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

export const AccountAdminListResponseSchema = createMcpResponseSchema(
  AccountAdminEntitySchema
)
  .extend({
    pagination: AccountAdminPaginationSchema.optional()
  })
  .passthrough();

export const AccountAdminToolResponseSchema = createMcpResponseSchema(
  AccountAdminEntitySchema
)
  .extend({
    pagination: AccountAdminPaginationSchema.optional(),
    meta: AccountAdminToolMetaSchema.optional(),
    warnings: z.array(McpWarningSchema).default([])
  })
  .passthrough();

const CompanyPatchChangesSchema = z
  .object({
    name: z.string().min(1).optional(),
    trade: z.string().min(1).optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().optional(),
    state_or_province: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    website_url: z.string().optional(),
    description: z.string().optional(),
    erp_id: z.string().optional(),
    tax_id: z.string().optional()
  })
  .passthrough()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    { message: "Debes incluir al menos un campo en changes." }
  );

const UserPatchChangesSchema = z
  .object({
    status: z.enum(["active", "inactive"]).optional(),
    company_id: z.string().min(1).optional()
  })
  .passthrough()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    { message: "Debes incluir al menos un campo en changes." }
  );

export const CompaniesPatchInputSchema = z.object({
  accountId: z
    .string()
    .optional()
    .describe("Account ID directo (con o sin prefijo b.)."),
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para derivar accountId (removiendo prefijo b.)."),
  region: z
    .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
    .optional()
    .describe("Region opcional para enrutar la peticion."),
  companyId: z.string().min(1).describe("ID de la compania a actualizar."),
  changes: CompanyPatchChangesSchema.describe(
    "Campos a actualizar en la compania."
  ),
  additionalPayload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Campos adicionales no modelados del payload PATCH."),
  confirm: z
    .boolean()
    .default(false)
    .describe("Debe ser true para ejecutar el PATCH real.")
});

export const UsersPatchInputSchema = z.object({
  accountId: z
    .string()
    .optional()
    .describe("Account ID directo (con o sin prefijo b.)."),
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para derivar accountId (removiendo prefijo b.)."),
  region: z
    .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
    .optional()
    .describe("Region opcional para enrutar la peticion."),
  userId: z.string().min(1).describe("ID del usuario a actualizar."),
  changes: UserPatchChangesSchema.describe("Campos a actualizar del usuario."),
  additionalPayload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Campos adicionales no modelados del payload PATCH."),
  confirm: z
    .boolean()
    .default(false)
    .describe("Debe ser true para ejecutar el PATCH real.")
});

export const AccountUsersCreateInputSchema = z.object({
  accountId: z
    .string()
    .optional()
    .describe("Account ID directo (con o sin prefijo b.)."),
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para derivar accountId (removiendo prefijo b.)."),
  region: z
    .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
    .optional()
    .describe("Region opcional para enrutar la peticion."),
  payload: z
    .record(z.string(), z.unknown())
    .describe("Payload exacto para crear el usuario en HQ.")
});

export const ProjectUsersCreateInputSchema = z
  .object({
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
    projectId: z
      .string()
      .optional()
      .describe("Project ID directo (con o sin prefijo b.)."),
    projectName: z
      .string()
      .optional()
      .describe("Nombre del proyecto para resolver projectId via hub."),
    region: z
      .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
      .optional()
      .describe("Region opcional para enrutar la peticion."),
    payload: z
      .record(z.string(), z.unknown())
      .describe("Payload exacto para crear el usuario del proyecto.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

export const ProjectUsersPatchInputSchema = z
  .object({
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
    projectId: z
      .string()
      .optional()
      .describe("Project ID directo (con o sin prefijo b.)."),
    projectName: z
      .string()
      .optional()
      .describe("Nombre del proyecto para resolver projectId via hub."),
    userId: z.string().min(1).describe("ID del usuario a actualizar en el proyecto."),
    region: z
      .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
      .optional()
      .describe("Region opcional para enrutar la peticion."),
    payload: z
      .record(z.string(), z.unknown())
      .describe("Payload exacto para PATCH del usuario del proyecto."),
    confirm: z
      .boolean()
      .default(false)
      .describe("Debe ser true para ejecutar el PATCH real.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });
