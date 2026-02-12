import { z } from "zod";

export const AecProjectSchema = z.object({
  hubId: z.string().describe("ID del Hub de Autodesk (b.xxx)")
});

export const AecElementSchema = z.object({
  projectId: z.string().describe("ID del proyecto en formato GraphQL (Base64)"),
  category: z.string().optional().describe("Categoría de Revit (ej: Walls, Windows)"),
  type: z.string().optional().describe("Nombre del tipo de elemento (ej: w01)")
});