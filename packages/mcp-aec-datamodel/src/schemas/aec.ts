import { z } from "zod";

export const AecProjectSchema = z.object({
  hubId: z.string().describe("ID del Hub de Autodesk (b.xxx)")
});

export const AecElementQuerySchema = z.object({
  projectId: z.string().describe("ID del proyecto en formato GraphQL (Base64)"),
  filterQuery: z.string().describe("Query de filtrado en lenguaje AEC (ej: property.name.Category == 'Walls' and property.value.Area > 10)"),
  propertiesToFetch: z.array(z.string()).optional().describe("Lista opcional de nombres de propiedades específicas a mostrar (ej: ['Area', 'Length', 'Volume'])")
});