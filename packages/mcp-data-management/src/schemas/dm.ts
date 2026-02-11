import { z } from "zod";

export const HubIdSchema = z.object({
  hubId: z.string().optional().describe("ID del Hub de Autodesk. Si no se provee, se usa el de las ENV.")
});

export const ProjectIdSchema = z.object({
  hubId: z.string().optional(),
  projectId: z.string().describe("ID del proyecto (b.xxxx...)")
});