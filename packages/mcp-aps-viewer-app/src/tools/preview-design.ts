import { z } from "zod";
import {
  fetchApsJson,
  getAccAccessToken,
  normalizeProjectIdWithB,
  queryAecDataModel
} from "@tad/shared";

type DerivativeFormat = "latest" | "fallback";

type ToolFactoryOptions = {
  derivativeFormat: DerivativeFormat;
};

type TipResponse = {
  data?: {
    attributes?: {
      displayName?: string;
    };
    relationships?: {
      derivatives?: {
        data?: {
          id?: string;
        };
      };
    };
  };
};

type GraphqlEnvelope<TData> = {
  data?: TData;
  errors?: unknown[];
};

type AecProjectsQueryData = {
  projects?: {
    results?: Array<{
      id?: string;
      name?: string;
    }>;
  };
};

type AecElementGroupsQueryData = {
  elementGroupsByProject?: {
    results?: Array<{
      id?: string;
      name?: string;
      alternativeIdentifiers?: {
        fileUrn?: string | null;
        fileVersionUrn?: string | null;
      } | null;
    }>;
  };
};

type ResolvedViewerModel = {
  urn: string;
  name: string;
  source: string;
  projectAecId?: string;
  modelId?: string;
};

const GET_AEC_PROJECTS_QUERY = `
  query GetProjects($hubId: ID!) {
    projects(hubId: $hubId) {
      results {
        id
        name
      }
    }
  }
`;

const GET_AEC_ELEMENT_GROUPS_QUERY = `
  query GetElementGroupsByProject($projectId: ID!) {
    elementGroupsByProject(projectId: $projectId) {
      results {
        id
        name
        alternativeIdentifiers {
          fileUrn
          fileVersionUrn
        }
      }
    }
  }
`;

function getViewerConfig(input: {
  region: string;
  derivativeFormat: DerivativeFormat;
  accessToken: string;
}) {
  const normalizedRegion = (input.region || "US").toUpperCase();
  const isUs = normalizedRegion === "US";

  if (input.derivativeFormat === "fallback") {
    return {
      accessToken: input.accessToken,
      env: "AutodeskProduction",
      api: isUs ? "derivativeV2" : `derivativeV2_${normalizedRegion}`
    };
  }

  return {
    accessToken: input.accessToken,
    env: "AutodeskProduction2",
    api: isUs ? "streamingV2" : `streamingV2_${normalizedRegion}`
  };
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizeViewerUrn(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("URN vacia. No se puede inicializar el Viewer.");
  }

  if (trimmed.startsWith("urn:") || trimmed.includes(":") || trimmed.includes("?")) {
    return toBase64Url(trimmed);
  }

  return trimmed
    .replace(/^urn:/i, "")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getAecHubId(inputHubId?: string): string {
  const hubId =
    inputHubId?.trim() ||
    process.env.APS_HUB_AEC_ID?.trim() ||
    process.env.APS_HUB_ID?.trim() ||
    "";

  if (!hubId) {
    throw new Error(
      "Para resolver projectName en AEC debes enviar hubId o configurar APS_HUB_AEC_ID."
    );
  }

  if (!hubId.toLowerCase().startsWith("urn:")) {
    throw new Error("hubId de AEC debe iniciar con 'urn:'.");
  }

  return hubId;
}

function pickByName<T extends { name?: string }>(
  items: T[],
  expectedName: string,
  entityLabel: string
): T {
  const wanted = normalizeName(expectedName);
  if (!wanted) {
    throw new Error(`${entityLabel}Name es requerido.`);
  }

  const exact = items.find((item) => normalizeName(item.name) === wanted);
  if (exact) return exact;

  const partial = items.filter((item) => normalizeName(item.name).includes(wanted));
  if (partial.length === 1) {
    return partial[0];
  }

  if (partial.length > 1) {
    throw new Error(
      `Se encontraron multiples ${entityLabel}s para '${expectedName}'. Usa un nombre mas especifico o envia ${entityLabel}Id.`
    );
  }

  const sample = items
    .map((item) => item.name?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 10);
  const suffix =
    sample.length > 0
      ? ` Opciones: ${sample.join(", ")}`
      : "";

  throw new Error(`No se encontro ${entityLabel} '${expectedName}'.${suffix}`);
}

async function queryAec<TData>(
  query: string,
  variables: Record<string, unknown>
): Promise<TData> {
  const response = (await queryAecDataModel(query, variables)) as GraphqlEnvelope<TData>;

  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    throw new Error(`AEC GraphQL Error: ${JSON.stringify(response.errors)}`);
  }

  if (!response || typeof response !== "object" || !response.data) {
    throw new Error("AEC GraphQL no devolvio data.");
  }

  return response.data;
}

async function resolveProjectAecId(args: {
  projectAecId?: string;
  projectName?: string;
  hubId?: string;
}): Promise<string> {
  const directProjectId = args.projectAecId?.trim();
  if (directProjectId) {
    return directProjectId;
  }

  const projectName = args.projectName?.trim();
  if (!projectName) {
    throw new Error(
      "Para resolver un modelo por AEC debes enviar projectAecId o projectName."
    );
  }

  const hubId = getAecHubId(args.hubId);
  const data = await queryAec<AecProjectsQueryData>(GET_AEC_PROJECTS_QUERY, { hubId });
  const projects = (data.projects?.results ?? []).filter(
    (item) => typeof item?.id === "string" && item.id.trim().length > 0
  );

  if (projects.length === 0) {
    throw new Error("No se encontraron proyectos AEC en el hub configurado.");
  }

  const project = pickByName(projects, projectName, "proyecto");
  const resolvedId = project.id?.trim();
  if (!resolvedId) {
    throw new Error("Proyecto AEC sin id valido.");
  }
  return resolvedId;
}

async function resolveAecModelUrn(args: {
  hubId?: string;
  projectAecId?: string;
  projectName?: string;
  modelId?: string;
  modelName?: string;
}): Promise<ResolvedViewerModel> {
  const projectAecId = await resolveProjectAecId(args);
  const data = await queryAec<AecElementGroupsQueryData>(GET_AEC_ELEMENT_GROUPS_QUERY, {
    projectId: projectAecId
  });
  const models = (data.elementGroupsByProject?.results ?? []).filter(
    (item) => typeof item?.id === "string" && item.id.trim().length > 0
  );

  if (models.length === 0) {
    throw new Error("No se encontraron modelos (element groups) para el proyecto AEC.");
  }

  const modelId = args.modelId?.trim();
  const modelName = args.modelName?.trim();

  const model =
    modelId
      ? models.find((item) => item.id?.trim() === modelId)
      : modelName
        ? pickByName(models, modelName, "modelo")
        : null;

  if (!model) {
    throw new Error(
      "No se encontro el modelo solicitado. Envia modelId valido o modelName exacto."
    );
  }

  const fileVersionUrn = model.alternativeIdentifiers?.fileVersionUrn?.trim();
  const fileUrn = model.alternativeIdentifiers?.fileUrn?.trim();
  const urn = fileVersionUrn || fileUrn;

  if (!urn) {
    throw new Error(
      "El modelo no incluye fileVersionUrn/fileUrn en AEC Data Model."
    );
  }

  return {
    urn,
    name: model.name?.trim() || model.id?.trim() || "Model",
    source: fileVersionUrn ? "aec.fileVersionUrn" : "aec.fileUrn",
    projectAecId,
    modelId: model.id?.trim()
  };
}

async function resolveUrn(args: {
  projectId?: string;
  designId?: string;
  urn?: string;
  fileVersionUrn?: string;
  hubId?: string;
  projectAecId?: string;
  projectName?: string;
  modelId?: string;
  modelName?: string;
}) {
  const fileVersionUrn = args.fileVersionUrn?.trim();
  if (fileVersionUrn) {
    return {
      urn: fileVersionUrn,
      name: args.modelName?.trim() || fileVersionUrn,
      source: "input.fileVersionUrn"
    };
  }

  const shouldResolveAec =
    Boolean(args.projectAecId?.trim() || args.projectName?.trim()) &&
    Boolean(args.modelId?.trim() || args.modelName?.trim());

  if (shouldResolveAec) {
    return resolveAecModelUrn({
      hubId: args.hubId,
      projectAecId: args.projectAecId,
      projectName: args.projectName,
      modelId: args.modelId,
      modelName: args.modelName
    });
  }

  if (args.urn?.trim()) {
    return {
      urn: args.urn.trim(),
      name: args.modelName?.trim() || args.urn.trim(),
      source: "input.urn"
    };
  }

  if (!args.designId?.trim()) {
    throw new Error(
      "Debes enviar fileVersionUrn, o projectName+modelName (AEC), o urn, o designId+projectId."
    );
  }

  const projectId = args.projectId?.trim();
  if (!projectId) {
    throw new Error("projectId es requerido cuando envias designId.");
  }

  const token = await getAccAccessToken();
  const projectIdWithB = normalizeProjectIdWithB(projectId);
  const tip = await fetchApsJson<TipResponse>(
    `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(
      projectIdWithB
    )}/items/${encodeURIComponent(args.designId.trim())}/tip`,
    {
      token,
      serviceName: "viewer.preview.resolveTip"
    }
  );

  const urn = tip?.data?.relationships?.derivatives?.data?.id;
  if (!urn) {
    throw new Error(
      "No se encontro derivativo para el designId indicado. Verifica que el modelo este procesado."
    );
  }

  const name =
    tip?.data?.attributes?.displayName?.trim() ||
    args.designId.trim();

  return { urn, name, source: "dm.tip.derivative" };
}

export const previewDesignToolFactory = (options: ToolFactoryOptions) => ({
  name: "preview-design",
  config: {
    title: "Preview design",
    description:
      "Abre una vista interactiva del modelo en APS Viewer dentro de MCP Apps.",
    inputSchema: {
      projectId: z
        .string()
        .optional()
        .describe("Project ID de Data Management (requerido si envias designId)."),
      designId: z
        .string()
        .optional()
        .describe("ID del item de Data Management para resolver por tip."),
      projectAecId: z
        .string()
        .optional()
        .describe("Project ID de AEC GraphQL (urn:...) para resolver modelos por AEC."),
      projectName: z
        .string()
        .optional()
        .describe("Nombre del proyecto AEC (usar junto con modelName)."),
      modelId: z
        .string()
        .optional()
        .describe("ID del modelo (elementGroupId) del AEC Data Model."),
      modelName: z
        .string()
        .optional()
        .describe("Nombre del modelo en AEC Data Model."),
      fileVersionUrn: z
        .string()
        .optional()
        .describe("URN de version del archivo (ej: urn:adsk.wipprod:fs.file:vf...?...)."),
      urn: z
        .string()
        .optional()
        .describe("URN directa para cargar en Viewer."),
      hubId: z
        .string()
        .optional()
        .describe("Hub ID AEC (urn:...) para resolver projectName."),
      region: z
        .string()
        .optional()
        .describe("Region del proyecto (US por defecto).")
    },
    annotations: { readOnlyHint: true },
    _meta: {
      ui: {
        resourceUri: "ui://preview-design/viewer.html"
      }
    }
  },
  callback: async (args: any) => {
    const resolved = await resolveUrn({
      projectId: args.projectId,
      designId: args.designId,
      urn: args.urn,
      fileVersionUrn: args.fileVersionUrn,
      hubId: args.hubId,
      projectAecId: args.projectAecId,
      projectName: args.projectName,
      modelId: args.modelId,
      modelName: args.modelName
    });

    const viewerToken = await getAccAccessToken();
    const encodedUrn = normalizeViewerUrn(resolved.urn);

    const output = {
      name: resolved.name,
      urn: encodedUrn,
      rawUrn: resolved.urn,
      source: resolved.source,
      ...(resolved.projectAecId ? { projectAecId: resolved.projectAecId } : {}),
      ...(resolved.modelId ? { modelId: resolved.modelId } : {}),
      config: getViewerConfig({
        region: args.region ?? "US",
        derivativeFormat: options.derivativeFormat,
        accessToken: viewerToken
      })
    };

    return {
      structuredContent: output,
      content: [
        {
          type: "text" as const,
          text: `Preview listo para ${output.name}`
        }
      ]
    };
  }
});
