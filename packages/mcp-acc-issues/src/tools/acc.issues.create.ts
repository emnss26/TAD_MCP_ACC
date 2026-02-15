import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { createIssue } from "../acc/issues.client.js";
import { CreateIssueSchema } from "../schemas/issues.js";

type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

function buildIssuePayload(args: CreateIssueInput): Record<string, unknown> {
  return {
    title: args.title,
    issueSubtypeId: args.issueSubtypeId,
    status: args.status,
    ...(args.description ? { description: args.description } : {}),
    ...(args.snapshotUrn ? { snapshotUrn: args.snapshotUrn } : {}),
    ...(args.assignedTo ? { assignedTo: args.assignedTo } : {}),
    ...(args.assignedToType ? { assignedToType: args.assignedToType } : {}),
    ...(args.dueDate ? { dueDate: args.dueDate } : {}),
    ...(args.startDate ? { startDate: args.startDate } : {}),
    ...(args.locationId ? { locationId: args.locationId } : {}),
    ...(args.locationDetails ? { locationDetails: args.locationDetails } : {}),
    ...(args.rootCauseId ? { rootCauseId: args.rootCauseId } : {}),
    ...(args.issueTemplateId ? { issueTemplateId: args.issueTemplateId } : {}),
    ...(args.published !== undefined ? { published: args.published } : {}),
    ...(args.watchers ? { watchers: args.watchers } : {}),
    ...(args.customAttributes ? { customAttributes: args.customAttributes } : {}),
    ...(args.gpsCoordinates ? { gpsCoordinates: args.gpsCoordinates } : {}),
    ...(args.additionalPayload ?? {})
  };
}

function registerIssueCreateTool(
  server: McpServer,
  toolName: "acc_create_issue" | "acc_issues_create"
) {
  server.registerTool(
    toolName,
    {
      title: "ACC Issues - Create",
      description:
        "Crea un issue en ACC usando projectId o projectName + hubId con salida estructurada JSON.",
      inputSchema: CreateIssueSchema.shape
    },
    async (args: CreateIssueInput) => {
      const token = await getAccAccessToken();
      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const payload = buildIssuePayload(args);
      const created = await createIssue({
        token,
        projectId: resolvedProject.projectId,
        payload,
        region: args.region
      });

      const output = buildMcpResponse({
        results: [created as Record<string, unknown>],
        pagination: {
          totalResults: 1,
          returned: 1,
          offset: 0,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: toolName,
          generatedAt: new Date().toISOString(),
          source: "construction/issues/v1/projects/:projectId/issues",
          projectResolution: {
            source: resolvedProject.source,
            hubId: resolvedProject.hubId,
            requestedProjectName: resolvedProject.requestedProjectName,
            resolvedProjectName: resolvedProject.resolvedProjectName,
            rawProjectId: resolvedProject.rawProjectId,
            issuesProjectId: resolvedProject.projectId
          }
        }
      });

      return {
        content: [{ type: "text", text: stringifyMcpPayload(output) }]
      };
    }
  );
}

export function registerCreateIssue(server: McpServer) {
  registerIssueCreateTool(server, "acc_create_issue");
  registerIssueCreateTool(server, "acc_issues_create");
}
