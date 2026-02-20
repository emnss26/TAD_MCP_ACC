import { z } from "zod";

export const PaginationSchema = {
  pageSize: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe("Cantidad de elementos por pagina."),
  offset: z.number().min(0).default(0).describe("Indice de inicio."),
  outputMode: z
    .enum(["summary", "compact", "full", "ids_only"])
    .default("compact")
    .describe("Nivel de detalle del resultado."),
  fields: z.array(z.string()).optional().describe("Campos especificos a incluir.")
};

export type OffsetPaginationInputSchemaOptions = {
  includeFetchAll?: boolean;
  maxItemsMax?: number;
  maxItemsDefault?: number;
  limitDescription?: string;
  maxItemsDescription?: string;
};

type BaseOffsetPaginationInputSchema = {
  limit: z.ZodDefault<z.ZodNumber>;
  offset: z.ZodDefault<z.ZodNumber>;
  cursor: z.ZodOptional<z.ZodString>;
  view: z.ZodDefault<z.ZodEnum<{ summary: "summary"; page: "page"; full: "full" }>>;
  outputFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
};

type FetchAllOffsetPaginationInputSchema = BaseOffsetPaginationInputSchema & {
  fetchAll: z.ZodDefault<z.ZodBoolean>;
  maxPages: z.ZodDefault<z.ZodNumber>;
  maxItems: z.ZodDefault<z.ZodNumber>;
};

export function createOffsetPaginationInputSchema(
  options?: Omit<OffsetPaginationInputSchemaOptions, "includeFetchAll"> & {
    includeFetchAll?: true;
  }
): FetchAllOffsetPaginationInputSchema;
export function createOffsetPaginationInputSchema(
  options: Omit<OffsetPaginationInputSchemaOptions, "includeFetchAll"> & {
    includeFetchAll: false;
  }
): BaseOffsetPaginationInputSchema;
export function createOffsetPaginationInputSchema(
  options: OffsetPaginationInputSchemaOptions = {}
) {
  const includeFetchAll = options.includeFetchAll ?? true;
  const maxItemsMax = options.maxItemsMax ?? 5000;
  const maxItemsDefault = options.maxItemsDefault ?? 1000;
  const limitDescription =
    options.limitDescription ?? "Cantidad de resultados por pagina.";
  const maxItemsDescription =
    options.maxItemsDescription ?? "Maximo de elementos al usar fetchAll.";

  const base: BaseOffsetPaginationInputSchema = {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe(limitDescription),
    offset: z.number().int().min(0).default(0).describe("Indice de inicio."),
    cursor: z
      .string()
      .optional()
      .describe(
        "Cursor de paginacion en formato offset:<n>. Tiene prioridad sobre offset."
      ),
    view: z
      .enum(["summary", "page", "full"])
      .default("page")
      .describe("Nivel de detalle de salida."),
    outputFields: z
      .array(z.string().min(1))
      .optional()
      .describe("Columnas a incluir en la salida tabular (cols/rows).")
  };

  if (!includeFetchAll) {
    return base as BaseOffsetPaginationInputSchema;
  }

  return {
    ...base,
    fetchAll: z
      .boolean()
      .default(false)
      .describe(
        "Si es true y view=full, recorre varias paginas hasta agotar o llegar a limites."
      ),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe("Maximo de paginas al usar fetchAll."),
    maxItems: z
      .number()
      .int()
      .min(1)
      .max(maxItemsMax)
      .default(maxItemsDefault)
      .describe(maxItemsDescription)
  } as FetchAllOffsetPaginationInputSchema;
}
