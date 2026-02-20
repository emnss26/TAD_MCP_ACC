import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  buildMcpResponse,
  parseOffsetCursor,
  type PaginatedResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { listIssues } from "../acc/issues.client.js";
import { IssuesPaginationSchema } from "../schemas/pagination.js";
import { IssueListResponseSchema, IssueToolResponseSchema } from "../schemas/issues.js";

type IssuesPage = PaginatedResponse<unknown> & {
  schemaWarning?: string;
};

const Input = z.object({
  containerId: z
    .string()
    .min(1)
    .describe("ID del contenedor BIM 360/Issues v2."),
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
          "La respuesta final de bim360_issues_list incluye campos/formatos fuera del schema esperado.",
        source: "bim360_issues_list"
      }
    ]
  };
}

export function registerBim360IssuesList(server: McpServer) {
  server.registerTool(
    "bim360_issues_list",
    {
      title: "BIM 360 Issues - List",
      description:
        "Lista issues usando issues/v2 por containerId.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const offset = parseOffsetCursor(args.cursor) ?? args.offset;
      const fetchAll = args.view === "full" ? args.fetchAll : false;

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
              containerId: args.containerId,
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
          source: "bim360_issues_list"
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
                  offset,
                  totalResults: Array.isArray(data.results) ? data.results.length : 0,
                  returned: Array.isArray(data.results) ? data.results.length : 0,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "bim360_issues_list",
            generatedAt: new Date().toISOString(),
            source: "issues/v2/containers/:containerId/issues",
            options: {
              containerId: args.containerId,
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
