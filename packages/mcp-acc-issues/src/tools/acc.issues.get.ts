import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  type PaginatedResponse,
  type ResolveProjectResult,
  stringifyMcpPayload
} from "@tad/shared";
import { listIssues } from "../acc/issues.client.js";
import { IssuesPaginationSchema } from "../schemas/pagination.js";
import { IssueListResponseSchema, IssueToolResponseSchema } from "../schemas/issues.js";

type IssuesPage = PaginatedResponse<unknown> & {
  schemaWarning?: string;
};

type ProjectResolution = Omit<ResolveProjectResult, "projectId"> & {
  issuesProjectId: string;
};

const Input = z.object({
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
  projectId: z
    .string()
    .min(3)
    .optional()
    .describe("Project ID directo (con o sin prefijo b.)."),
  projectName: z
    .string()
    .min(2)
    .optional()
    .describe("Nombre del proyecto para resolver el projectId usando el hub."),
  ...IssuesPaginationSchema
});

type InputArgs = z.infer<typeof Input>;

function parseIssuePage(raw: unknown): IssuesPage {
  const parsed = IssueListResponseSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as IssuesPage;
  }

  if (raw && typeof raw === "object") {
    return {
      ...(raw as IssuesPage),
      schemaWarning: "La respuesta de Issues incluye campos/formatos fuera del schema esperado."
    };
  }

  return {
    results: [],
    schemaWarning: "La respuesta de Issues no tiene un formato JSON valido."
  };
}

function finalizePayload(payload: Record<string, unknown>) {
  const parsed = IssueToolResponseSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }

  const currentWarnings = Array.isArray(payload.warnings)
    ? (payload.warnings as Array<Record<string, unknown>>)
    : [];

  return {
    ...payload,
    warnings: [
      ...currentWarnings,
      {
        code: "schema_warning",
        message:
          "La respuesta final de acc_issues_list incluye campos/formatos fuera del schema esperado.",
        source: "acc_issues_list"
      }
    ]
  };
}

export function registerAccIssuesList(server: McpServer) {
  server.registerTool(
    "acc_issues_list",
    {
      title: "ACC Issues - List",
      description:
        "Lista issues de ACC. Puede resolver projectId desde projectName + hubId (Data Management).",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const project: ProjectResolution = {
        source: resolvedProject.source,
        hubId: resolvedProject.hubId,
        requestedProjectName: resolvedProject.requestedProjectName,
        resolvedProjectName: resolvedProject.resolvedProjectName,
        rawProjectId: resolvedProject.rawProjectId,
        issuesProjectId: resolvedProject.projectId
      };

      const data = await fetchAllPages<IssuesPage>({
        fetchAll: args.fetchAll,
        limit: args.limit,
        offset: args.offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseIssuePage(
            await listIssues({
              token,
              projectId: project.issuesProjectId,
              limit,
              offset
            })
          )
      });

      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (data.schemaWarning) {
        warnings.push({
          code: "issues_page_schema_warning",
          message: data.schemaWarning,
          source: "acc_issues_list"
        });
      }

      const payload = finalizePayload(
        buildMcpResponse({
          results: Array.isArray(data.results) ? data.results : [],
          pagination:
            data.pagination && typeof data.pagination === "object"
              ? (data.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset: args.offset,
                  totalResults: Array.isArray(data.results) ? data.results.length : 0,
                  returned: Array.isArray(data.results) ? data.results.length : 0,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_issues_list",
            generatedAt: new Date().toISOString(),
            source: "construction/issues/v1/projects/:projectId/issues",
            projectResolution: project,
            options: {
              fetchAll: args.fetchAll,
              limit: args.limit,
              offset: args.offset,
              maxPages: args.maxPages,
              maxItems: args.maxItems
            }
          },
          warnings
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
