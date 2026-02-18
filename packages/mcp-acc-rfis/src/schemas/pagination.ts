import { z } from "zod";

export const RfisPaginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Cantidad de resultados por pagina."),
  offset: z.number().int().min(0).default(0).describe("Indice de inicio."),
  cursor: z
    .string()
    .optional()
    .describe("Cursor de paginacion en formato offset:<n>. Tiene prioridad sobre offset."),
  view: z
    .enum(["summary", "page", "full"])
    .default("page")
    .describe("Nivel de detalle de salida."),
  outputFields: z
    .array(z.string().min(1))
    .optional()
    .describe("Columnas a incluir en la salida tabular (cols/rows)."),
  fetchAll: z
    .boolean()
    .default(false)
    .describe("Si es true y view=full, recorre varias paginas hasta agotar o llegar a limites."),
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
    .max(5000)
    .default(1000)
    .describe("Maximo de RFIs al usar fetchAll.")
};
