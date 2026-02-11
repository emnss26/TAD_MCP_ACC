import { z } from "zod";

export const HubIdSchema = z.object({
  hubId: z.string().optional().describe("ID del Hub de Autodesk.")
});

export const ProjectIdSchema = z.object({
  hubId: z.string().optional(),
  projectId: z.string().describe("ID del proyecto (b.xxxx...)")
});

// NUEVO: Para navegar carpetas
export const FolderContentsSchema = z.object({
  projectId: z.string().describe("ID del proyecto."),
  folderId: z.string().describe("ID de la carpeta a explorar.")
});