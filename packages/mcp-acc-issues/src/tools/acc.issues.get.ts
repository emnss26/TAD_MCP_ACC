import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  parseOffsetCursor,
  type PaginatedResponse,
  type ResolveProjectResult,
  stringifyMcpPayload
} from "@tad/shared";
import { listIssues } from "../acc/issues.client.js";
import { getProjectUsers, getProjectCompanies } from "../acc/admin.client.js";
import { IssuesPaginationSchema } from "../schemas/pagination.js";
import { IssueListResponseSchema, IssueToolResponseSchema } from "../schemas/issues.js";

type IssueResult = Record<string, unknown>;

type IssuesPage = PaginatedResponse<IssueResult> & {
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

function getResultsArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as any).results)) {
    return (payload as any).results;
  }
  return [];
}

function buildIdentityMap(items: Record<string, unknown>[], idKeys: string[]) {
  const map: Record<string, Record<string, unknown>> = {};
  for (const item of items) {
    const id = idKeys
      .map((key) => item[key])
      .find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof id === "string") {
      map[id] = item;
    }
  }
  return map;
}

function resolveIdentity(
  id: unknown,
  usersById: Record<string, Record<string, unknown>>,
  companiesById: Record<string, Record<string, unknown>>
) {
  if (typeof id !== "string" || !id.trim()) return null;
  return usersById[id] ?? companiesById[id] ?? { id, unresolved: true };
}

function enrichIssueResult(
  issue: IssueResult,
  usersById: Record<string, Record<string, unknown>>,
  companiesById: Record<string, Record<string, unknown>>
) {
  const idFields = ["assignedTo", "ownerId", "openedBy", "closedBy", "createdBy", "updatedBy"] as const;
  const resolvedActors: Record<string, unknown> = {};
  for (const field of idFields) {
    if (field in issue) {
      resolvedActors[field] = resolveIdentity(issue[field], usersById, companiesById);
    }
  }

  const resolvedWatchers = Array.isArray(issue.watchers)
    ? issue.watchers.map((id) => resolveIdentity(id, usersById, companiesById))
    : [];

  const officialResponse =
    issue.officialResponse && typeof issue.officialResponse === "object"
      ? {
          ...(issue.officialResponse as Record<string, unknown>),
          resolvedRespondedBy: resolveIdentity(
            (issue.officialResponse as Record<string, unknown>).respondedBy,
            usersById,
            companiesById
          )
        }
      : null;

  const resolvedLinkedDocuments = Array.isArray(issue.linkedDocuments)
    ? issue.linkedDocuments.map((item) => {
        if (!item || typeof item !== "object") return item;
        const linked = item as Record<string, unknown>;
        return {
          ...linked,
          resolvedCreatedBy: resolveIdentity(linked.createdBy, usersById, companiesById),
          resolvedClosedBy: resolveIdentity(linked.closedBy, usersById, companiesById)
        };
      })
    : [];

  return {
    ...issue,
    resolvedActors,
    resolvedWatchers,
    ...(officialResponse ? { resolvedOfficialResponse: officialResponse } : {}),
    ...(resolvedLinkedDocuments.length > 0
      ? { resolvedLinkedDocuments }
      : {})
  };
}

async function fetchContext(projectId: string): Promise<{
  warnings: string[];
  usersById: Record<string, Record<string, unknown>>;
  companiesById: Record<string, Record<string, unknown>>;
}> {
  const warnings: string[] = [];
  const [usersRes, companiesRes] = await Promise.allSettled([
    getProjectUsers(projectId),
    getProjectCompanies(projectId)
  ]);

  const users = usersRes.status === "fulfilled" ? getResultsArray(usersRes.value) : [];
  const companies = companiesRes.status === "fulfilled" ? getResultsArray(companiesRes.value) : [];

  if (usersRes.status === "rejected") {
    warnings.push(`No se pudieron obtener usuarios: ${String(usersRes.reason)}`);
  }
  if (companiesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener companias: ${String(companiesRes.reason)}`);
  }

  return {
    warnings,
    usersById: buildIdentityMap(users, ["autodeskId", "id"]),
    companiesById: buildIdentityMap(companies, ["id"])
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
      const offset = parseOffsetCursor(args.cursor) ?? args.offset;
      const fetchAll = args.view === "full" ? args.fetchAll : false;

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
        fetchAll,
        limit: args.limit,
        offset,
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

      const context = await fetchContext(project.issuesProjectId);

      const rawResults = Array.isArray(data.results) ? data.results : [];
      const enrichedResults = rawResults.map((issue) =>
        enrichIssueResult(issue, context.usersById, context.companiesById)
      );

      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (data.schemaWarning) {
        warnings.push({
          code: "issues_page_schema_warning",
          message: data.schemaWarning,
          source: "acc_issues_list"
        });
      }
      for (const warning of context.warnings) {
        warnings.push({
          code: "context_fetch_warning",
          message: warning,
          source: "acc_issues_list"
        });
      }

      const payload = finalizePayload(
        buildMcpResponse({
          results: enrichedResults,
          pagination:
            data.pagination && typeof data.pagination === "object"
              ? (data.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset,
                  totalResults: enrichedResults.length,
                  returned: enrichedResults.length,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_issues_list",
            generatedAt: new Date().toISOString(),
            source: "construction/issues/v1/projects/:projectId/issues",
            projectResolution: project,
            options: {
              fetchAll,
              limit: args.limit,
              offset,
              cursor: args.cursor,
              view: args.view,
              outputFields: args.outputFields,
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
