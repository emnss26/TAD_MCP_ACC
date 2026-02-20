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
import { listRfis } from "../acc/rfis.client.js";
import { RfisPaginationSchema } from "../schemas/pagination.js";
import { RfiListResponseSchema, RfiToolResponseSchema } from "../schemas/rfis.js";

type RfiResult = Record<string, unknown>;
type RfiListPage = PaginatedResponse<RfiResult> & {
  schemaWarning?: string;
};

const Input = z.object({
  containerId: z
    .string()
    .min(1)
    .describe("ID del contenedor BIM 360 para RFIs."),
  ...RfisPaginationSchema
});

type InputArgs = z.infer<typeof Input>;

function parseRfiPage(raw: unknown): RfiListPage {
  const parsed = RfiListResponseSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as RfiListPage;
  }

  if (raw && typeof raw === "object") {
    return {
      ...(raw as RfiListPage),
      schemaWarning: "La respuesta de RFIs incluye campos/formatos fuera del schema esperado."
    };
  }

  return {
    results: [],
    schemaWarning: "La respuesta de RFIs no tiene un formato JSON valido."
  };
}

function finalizePayload(payload: Record<string, unknown>) {
  const parsed = RfiToolResponseSchema.safeParse(payload);
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
          "La respuesta final de bim360_rfis_list incluye campos/formatos fuera del schema esperado.",
        source: "bim360_rfis_list"
      }
    ]
  };
}

export function registerBim360RfisList(server: McpServer) {
  server.registerTool(
    "bim360_rfis_list",
    {
      title: "BIM 360 RFIs - List",
      description: "Lista RFIs usando bim360/rfis/v2 por containerId.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const offset = parseOffsetCursor(args.cursor) ?? args.offset;
      const fetchAll = args.view === "full" ? args.fetchAll : false;

      const page = await fetchAllPages<RfiListPage, RfiResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseRfiPage(
            await listRfis({
              token,
              containerId: args.containerId,
              limit,
              offset
            })
          )
      });

      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (page.schemaWarning) {
        warnings.push({
          code: "rfis_page_schema_warning",
          message: page.schemaWarning,
          source: "bim360_rfis_list"
        });
      }

      const payload = finalizePayload(
        buildMcpResponse({
          results: Array.isArray(page.results) ? page.results : [],
          pagination:
            page.pagination && typeof page.pagination === "object"
              ? (page.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset,
                  totalResults: Array.isArray(page.results) ? page.results.length : 0,
                  returned: Array.isArray(page.results) ? page.results.length : 0,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "bim360_rfis_list",
            generatedAt: new Date().toISOString(),
            source: "bim360/rfis/v2/containers/:containerId/rfis",
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
