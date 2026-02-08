import { z } from "zod";

export const AccIssue = z.object({
  id: z.string().optional()
}).passthrough();

export const AccIssuesListResponse = z.any();