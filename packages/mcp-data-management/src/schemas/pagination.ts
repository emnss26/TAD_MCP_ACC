import { z } from "zod";

export const DmPaginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("Cantidad maxima de proyectos a devolver por pagina."),
  offset: z.number().int().min(0).default(0).describe("Indice de inicio.")
};
