import { z } from "zod";

export const AccountAdminPaginationInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Cantidad de resultados por pagina."),
  offset: z.number().int().min(0).default(0).describe("Indice de inicio."),
  fetchAll: z
    .boolean()
    .default(false)
    .describe("Si es true, recorre varias paginas hasta agotar o llegar a limites."),
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
    .max(10000)
    .default(2000)
    .describe("Maximo de elementos al usar fetchAll.")
};
