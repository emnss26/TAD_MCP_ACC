import { z } from "zod";

export const PaginationSchema = {
  pageSize: z.number().min(1).max(100).default(50).describe("Cantidad de elementos por página"),
  offset: z.number().min(0).default(0).describe("Índice de inicio"),
  outputMode: z.enum(["summary", "compact", "full", "ids_only"]).default("compact").describe("Nivel de detalle del resultado"),
  fields: z.array(z.string()).optional().describe("Campos específicos a incluir")
};