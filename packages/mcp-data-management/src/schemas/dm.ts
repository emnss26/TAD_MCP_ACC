import { z } from "zod";

export const HubIdSchema = z.object({
  hubId: z.string().optional().describe("ID del Hub. Si se omite, se usa el de las ENV.")
});

export const ProjectIdSchema = z.object({
  hubId: z.string().optional().describe("ID del Hub."),
  projectId: z.string().describe("ID del proyecto (empieza con 'b.')")
});

export const FolderContentsSchema = z.object({
  projectId: z.string().describe("ID del proyecto."),
  folderId: z.string().describe("ID de la carpeta (empieza con 'urn:adsk.wipprod:fs.folder:...')")
});

export const ItemVersionsSchema = z.object({
  projectId: z.string().describe("ID del proyecto."),
  itemId: z.string().describe("ID del archivo/item (empieza con 'urn:adsk.wipprod:dm.lineage:...')")
});