import { z } from "zod";

export const IssuesPaginationSchema = {
  limit: z.number().int().min(1).max(100).default(50).describe("Cantidad de resultados por página."),
  offset: z.number().int().min(0).default(0).describe("Índice de inicio."),
  fetchAll: z
    .boolean()
    .default(false)
    .describe("Si es true, recorre varias páginas hasta agotar o llegar a los límites."),
  maxPages: z.number().int().min(1).max(100).default(10).describe("Máximo de páginas al usar fetchAll."),
  maxItems: z.number().int().min(1).max(5000).default(1000).describe("Máximo de issues al usar fetchAll.")
};

