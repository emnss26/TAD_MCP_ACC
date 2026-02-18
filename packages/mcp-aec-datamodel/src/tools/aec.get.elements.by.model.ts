import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  stringifyMcpPayload,
  buildMcpResponse,
  clampListLimit,
  parseOffsetCursor
} from "@tad/shared";
import { z } from "zod";
import { getAecElementsByElementGroup } from "../aec/aec.client.js";

const AecElementsByModelSchema = z.object({
  elementGroupId: z.string().describe("ID del element group (modelo) obtenido de aec_get_models"),
  category: z.string().optional().describe("Filtro por categoria Revit (ej: Walls, Floors, Doors)"),
  onlyInstances: z.boolean().default(true).describe("Solo instancias (excluye tipos). Default: true"),
  limit: z.number().int().min(1).max(50).default(10),
  view: z.enum(["summary", "page", "full"]).default("summary"),
  outputFields: z.array(z.string().min(1)).optional(),
  cursor: z.string().optional(),
});

function pickProp(properties: any[], ...names: string[]): string | number | null {
  const normalized = names.map((n) => n.trim().toLowerCase());
  const hit = properties.find((p) =>
    normalized.includes(String(p?.name ?? "").trim().toLowerCase())
  );
  const val = hit?.value ?? null;
  if (val === null || val === undefined) return null;
  return typeof val === "number" ? val : String(val).trim() || null;
}

export function registerAecElementsByModel(server: McpServer) {
  server.registerTool(
    "aec_get_elements_by_model",
    {
      title: "AEC Data Model - Elements by Model",
      description:
        "Obtiene elementos de un modelo (elementGroup) con propiedades para cuantificacion.",
      inputSchema: AecElementsByModelSchema.shape,
    },
    async (args) => {
      try {
        const elementGroupId = String(args.elementGroupId ?? "").trim();
        if (!elementGroupId) throw new Error("elementGroupId es requerido.");

        const limit = clampListLimit(args.limit);
        const offset = parseOffsetCursor(args.cursor) ?? 0;

        let propertyFilter: string | undefined;
        if (args.category) {
          const cat = args.category.trim();
          const instanceFilter = `'property.name.Element Context'==Instance`;
          propertyFilter = args.onlyInstances
            ? `property.name.category==${cat} and ${instanceFilter}`
            : `property.name.category==${cat}`;
        } else if (args.onlyInstances) {
          propertyFilter = `'property.name.Element Context'==Instance`;
        }

        const elements = await getAecElementsByElementGroup(elementGroupId, {
          propertyFilter,
        });

        const rows = elements.map((el) => {
          const props = el.properties?.results ?? [];
          return {
            elementId: el.id,
            revitElementId:
              el.alternativeIdentifiers?.revitElementId ??
              pickProp(props, "Revit Element ID"),
            category: pickProp(props, "Revit Category Type Id", "Category"),
            familyName: pickProp(props, "Family Name", "Family"),
            elementName: pickProp(props, "Element Name", "Name") ?? el.name,
            typeMark: pickProp(props, "Type Mark", "Mark"),
            area: pickProp(props, "Area"),
            length: pickProp(props, "Length"),
            volume: pickProp(props, "Volume"),
            level: pickProp(props, "Level", "Base Constraint"),
          };
        });

        const totalArea = rows.reduce((acc, r) => {
          const v = typeof r.area === "number" ? r.area : parseFloat(String(r.area ?? ""));
          return acc + (isNaN(v) ? 0 : v);
        }, 0);

        const totalLength = rows.reduce((acc, r) => {
          const v = typeof r.length === "number" ? r.length : parseFloat(String(r.length ?? ""));
          return acc + (isNaN(v) ? 0 : v);
        }, 0);

        const totalVolume = rows.reduce((acc, r) => {
          const v = typeof r.volume === "number" ? r.volume : parseFloat(String(r.volume ?? ""));
          return acc + (isNaN(v) ? 0 : v);
        }, 0);

        const payload = buildMcpResponse({
          results: rows,
          pagination: {
            limit,
            offset,
            totalResults: rows.length,
            returned: rows.length,
            hasMore: rows.length > limit,
            nextOffset: rows.length > limit ? offset + limit : null,
          },
          meta: {
            tool: "aec_get_elements_by_model",
            generatedAt: new Date().toISOString(),
            source: "aec/graphql/elementsByElementGroup",
            options: {
              view: args.view,
              limit,
              cursor: args.cursor,
              outputFields: args.outputFields,
              elementGroupId,
              category: args.category ?? null,
              onlyInstances: args.onlyInstances,
              filterQuery: propertyFilter ?? null,
            },
            summary: {
              totalElements: rows.length,
              totalArea_m2: parseFloat(totalArea.toFixed(4)),
              totalLength_m: parseFloat(totalLength.toFixed(4)),
              totalVolume_m3: parseFloat(totalVolume.toFixed(4)),
            },
          },
        });

        return {
          content: [{ type: "text", text: stringifyMcpPayload(payload) }],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[AEC Error] ${message}`);
        return {
          isError: true,
          content: [{ type: "text", text: `Error al obtener elementos del modelo: ${message}` }],
        };
      }
    }
  );
}
