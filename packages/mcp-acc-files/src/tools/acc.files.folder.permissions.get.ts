import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  resolveProject,
  buildMcpResponse,
  getProjectTopFolders,
  getFolderContents,
  getFolderDetails,
  normalizeProjectIdWithB,
  normalizeProjectIdWithoutB,
  getProjectUsers,
  getProjectCompanies,
  stringifyMcpPayload
} from "@tad/shared";
import {
  FilesFolderPermissionsInputSchema,
  FilesPermissionsToolResponseSchema
} from "../schemas/files.js";
import { getFolderPermissions } from "../acc/files.client.js";

type PermissionRecord = Record<string, unknown>;
type ContextEntity = Record<string, unknown>;

type FolderNode = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
};

type FolderResolution = {
  source: "input.folderId" | "input.folderName.exact" | "input.folderName.partial";
  folderId: string;
  folderName: string | null;
  folderPath: string | null;
  scannedFolders?: number;
  scannedTopFolders?: number;
};

function getRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object") as Record<
      string,
      unknown
    >[];
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.results)) {
      return obj.results.filter(
        (item) => item && typeof item === "object"
      ) as Record<string, unknown>[];
    }
    if (Array.isArray(obj.data)) {
      return obj.data.filter(
        (item) => item && typeof item === "object"
      ) as Record<string, unknown>[];
    }
    if (Array.isArray(obj.items)) {
      return obj.items.filter(
        (item) => item && typeof item === "object"
      ) as Record<string, unknown>[];
    }
  }
  return [];
}

function getRecord(payload: unknown): Record<string, unknown> | null {
  if (payload && typeof payload === "object") {
    if ("data" in (payload as Record<string, unknown>)) {
      const data = (payload as Record<string, unknown>).data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
    }
    if (!Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
  }
  return null;
}

function getFolderName(entity: Record<string, unknown>): string {
  const attributes = (entity.attributes ?? {}) as Record<string, unknown>;
  const nameCandidates = [
    attributes.name,
    attributes.displayName,
    entity.name,
    entity.displayName
  ];
  for (const candidate of nameCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "(sin nombre)";
}

function isFolderEntity(entity: Record<string, unknown>): boolean {
  const type = entity.type;
  if (typeof type === "string" && type.toLowerCase() === "folders") return true;
  const id = entity.id;
  if (typeof id === "string" && id.includes("fs.folder")) return true;
  return false;
}

function mapByKeys(
  items: ContextEntity[],
  keys: string[]
): Record<string, ContextEntity> {
  const map: Record<string, ContextEntity> = {};
  for (const item of items) {
    for (const key of keys) {
      const value = item[key];
      if (typeof value === "string" && value.trim()) {
        map[value] = item;
      }
    }
  }
  return map;
}

function normalizePermissionSubjectType(value: unknown): string {
  if (typeof value !== "string") return "UNKNOWN";
  return value.trim().toUpperCase();
}

function getPermissionSubjectId(permission: PermissionRecord): string | null {
  const direct = permission.subjectId;
  if (typeof direct === "string" && direct.trim()) return direct;
  const subject = permission.subject;
  if (subject && typeof subject === "object") {
    const obj = subject as Record<string, unknown>;
    for (const key of ["subjectId", "id", "autodeskId"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return null;
}

function getPermissionActions(permission: PermissionRecord): string[] {
  const actions = permission.actions;
  if (Array.isArray(actions)) {
    return actions
      .filter((item) => typeof item === "string")
      .map((item) => item as string);
  }
  const permissions = permission.permissions;
  if (Array.isArray(permissions)) {
    return permissions
      .filter((item) => typeof item === "string")
      .map((item) => item as string);
  }
  return [];
}

async function resolveFolderByName(input: {
  projectIdWithB: string;
  hubId: string;
  folderName: string;
  maxFoldersScan: number;
}): Promise<FolderResolution> {
  const topFoldersRaw = await getProjectTopFolders({
    hubId: input.hubId,
    projectId: input.projectIdWithB
  });
  const topFolderEntities = getRecords(topFoldersRaw).filter(isFolderEntity);

  if (topFolderEntities.length === 0) {
    throw new Error(
      `No se encontraron top folders para el proyecto '${input.projectIdWithB}'.`
    );
  }

  const queue: FolderNode[] = topFolderEntities.map((entity) => ({
    id: String(entity.id),
    name: getFolderName(entity),
    path: getFolderName(entity),
    parentId: null
  }));
  const visited = new Set(queue.map((item) => item.id));
  const exactMatches: FolderNode[] = [];
  const partialMatches: FolderNode[] = [];

  const needle = input.folderName.trim().toLowerCase();
  let scanned = 0;

  while (queue.length > 0 && scanned < input.maxFoldersScan) {
    const node = queue.shift() as FolderNode;
    scanned += 1;

    const nodeNameLower = node.name.toLowerCase();
    if (nodeNameLower === needle) {
      exactMatches.push(node);
    } else if (nodeNameLower.includes(needle)) {
      partialMatches.push(node);
    }

    const contentsRaw = await getFolderContents({
      projectId: input.projectIdWithB,
      folderId: node.id,
      query: { "filter[type]": "folders" }
    }).catch(async () =>
      getFolderContents({
        projectId: input.projectIdWithB,
        folderId: node.id
      })
    );

    const children = getRecords(contentsRaw).filter(isFolderEntity);
    for (const child of children) {
      const childId = String(child.id ?? "");
      if (!childId || visited.has(childId)) continue;

      const childName = getFolderName(child);
      queue.push({
        id: childId,
        name: childName,
        path: `${node.path}/${childName}`,
        parentId: node.id
      });
      visited.add(childId);
    }
  }

  if (exactMatches.length === 1) {
    return {
      source: "input.folderName.exact",
      folderId: exactMatches[0].id,
      folderName: exactMatches[0].name,
      folderPath: exactMatches[0].path,
      scannedFolders: scanned,
      scannedTopFolders: topFolderEntities.length
    };
  }

  if (exactMatches.length > 1) {
    const samples = exactMatches
      .slice(0, 8)
      .map((item) => `- ${item.path} (${item.id})`)
      .join("\n");
    throw new Error(
      `Hay ${exactMatches.length} coincidencias exactas para carpeta '${input.folderName}'. Usa folderId.\n${samples}`
    );
  }

  if (partialMatches.length === 1) {
    return {
      source: "input.folderName.partial",
      folderId: partialMatches[0].id,
      folderName: partialMatches[0].name,
      folderPath: partialMatches[0].path,
      scannedFolders: scanned,
      scannedTopFolders: topFolderEntities.length
    };
  }

  if (partialMatches.length > 1) {
    const samples = partialMatches
      .slice(0, 8)
      .map((item) => `- ${item.path} (${item.id})`)
      .join("\n");
    throw new Error(
      `Hay ${partialMatches.length} coincidencias parciales para carpeta '${input.folderName}'. Usa folderId o un nombre mas especifico.\n${samples}`
    );
  }

  throw new Error(
    `No se encontro carpeta '${input.folderName}' tras escanear ${scanned} carpetas.`
  );
}

async function resolveFolder(input: {
  projectIdWithB: string;
  hubId: string | null;
  folderId?: string;
  folderName?: string;
  maxFoldersScan: number;
}) {
  if (input.folderId) {
    const detailsRaw = await getFolderDetails({
      projectId: input.projectIdWithB,
      folderId: input.folderId
    }).catch(() => null);
    const details = getRecord(detailsRaw);
    const name = details ? getFolderName(details) : null;
    return {
      source: "input.folderId" as const,
      folderId: input.folderId,
      folderName: name,
      folderPath: name
    };
  }

  if (!input.folderName) {
    throw new Error("Debes enviar folderId o folderName.");
  }

  if (!input.hubId) {
    throw new Error(
      "Para buscar folderName se requiere hubId (input o APS_HUB_ID en entorno)."
    );
  }

  return resolveFolderByName({
    projectIdWithB: input.projectIdWithB,
    hubId: input.hubId,
    folderName: input.folderName,
    maxFoldersScan: input.maxFoldersScan
  });
}

function enrichPermissions(input: {
  permissions: PermissionRecord[];
  usersById: Record<string, ContextEntity>;
  companiesById: Record<string, ContextEntity>;
  rolesById: Record<string, ContextEntity>;
  users: ContextEntity[];
}) {
  return input.permissions.map((permission) => {
    const subjectType = normalizePermissionSubjectType(
      permission.subjectType ??
        (permission.subject as Record<string, unknown> | undefined)?.subjectType
    );
    const subjectId = getPermissionSubjectId(permission);
    const actions = getPermissionActions(permission);

    let resolvedSubject: Record<string, unknown> | null = null;
    let resolvedRoleMembers: Record<string, unknown>[] | undefined;

    if (subjectType === "USER" && subjectId) {
      resolvedSubject = input.usersById[subjectId] ?? { id: subjectId, unresolved: true };
    } else if (subjectType === "COMPANY" && subjectId) {
      resolvedSubject =
        input.companiesById[subjectId] ?? { id: subjectId, unresolved: true };
    } else if (subjectType === "ROLE" && subjectId) {
      resolvedSubject = input.rolesById[subjectId] ?? { id: subjectId, unresolved: true };
      resolvedRoleMembers = input.users.filter((user) => {
        const roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
        return roleIds.includes(subjectId);
      });
    }

    return {
      ...permission,
      subjectType,
      subjectId,
      actions,
      resolvedSubject,
      ...(resolvedRoleMembers ? { resolvedRoleMembers } : {})
    };
  });
}

function finalizePayload(payload: Record<string, unknown>) {
  const parsed = FilesPermissionsToolResponseSchema.safeParse(payload);
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
          "La respuesta final de acc_files_folder_permissions_get incluye campos/formatos fuera del schema esperado.",
        source: "acc_files_folder_permissions_get"
      }
    ]
  };
}

export function registerAccFilesFolderPermissionsGet(server: McpServer) {
  server.registerTool(
    "acc_files_folder_permissions_get",
    {
      title: "ACC Files - Folder Permissions",
      description:
        "Obtiene permisos de una carpeta en BIM 360 Docs y mapea sujetos (USER/COMPANY/ROLE) con contexto de proyecto.",
      inputSchema: FilesFolderPermissionsInputSchema.shape
    },
    async (args) => {
      const token = await getAccAccessToken();

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID
      });

      const projectIdWithB = normalizeProjectIdWithB(resolvedProject.projectId);
      const projectIdWithoutB = normalizeProjectIdWithoutB(projectIdWithB);
      const hubId = args.hubId ?? resolvedProject.hubId ?? process.env.APS_HUB_ID ?? null;

      const folderResolution = await resolveFolder({
        projectIdWithB,
        hubId,
        folderId: args.folderId,
        folderName: args.folderName,
        maxFoldersScan: args.maxFoldersScan
      });

      const rawPermissions = await getFolderPermissions({
        token,
        projectIdWithoutB,
        folderId: folderResolution.folderId
      });
      const permissions = getRecords(rawPermissions) as PermissionRecord[];

      const warnings: Array<{ code: string; message: string; source: string }> = [];

      const context: {
        users?: ContextEntity[];
        companies?: ContextEntity[];
      } = {};
      const dictionaries: Record<string, unknown> = {};

      let users: ContextEntity[] = [];
      let companies: ContextEntity[] = [];
      let usersById: Record<string, ContextEntity> = {};
      let companiesById: Record<string, ContextEntity> = {};
      let rolesById: Record<string, ContextEntity> = {};

      if (args.includeContext) {
        const [usersRes, companiesRes] = await Promise.allSettled([
          getProjectUsers(projectIdWithoutB),
          getProjectCompanies(projectIdWithoutB)
        ]);

        if (usersRes.status === "fulfilled") {
          users = getRecords(usersRes.value);
          usersById = mapByKeys(users, ["id", "autodeskId"]);

          for (const user of users) {
            const roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
            const roles = Array.isArray(user.roles) ? user.roles : [];

            for (const roleId of roleIds) {
              if (typeof roleId === "string" && roleId.trim()) {
                rolesById[roleId] = {
                  ...(rolesById[roleId] ?? {}),
                  id: roleId,
                  users: Array.isArray((rolesById[roleId] ?? {}).users)
                    ? ((rolesById[roleId] ?? {}).users as ContextEntity[])
                    : []
                };
                const bucket = rolesById[roleId].users as ContextEntity[];
                bucket.push(user);
              }
            }

            for (const role of roles) {
              if (role && typeof role === "object") {
                const roleObj = role as Record<string, unknown>;
                const roleId =
                  typeof roleObj.id === "string"
                    ? roleObj.id
                    : typeof roleObj.roleId === "string"
                      ? roleObj.roleId
                      : null;
                if (roleId) {
                  rolesById[roleId] = {
                    ...(rolesById[roleId] ?? {}),
                    ...roleObj,
                    id: roleId
                  };
                }
              }
            }
          }
        } else {
          warnings.push({
            code: "context_fetch_warning",
            message: `No se pudieron obtener usuarios del proyecto: ${String(
              usersRes.reason
            )}`,
            source: "acc_files_folder_permissions_get"
          });
        }

        if (companiesRes.status === "fulfilled") {
          companies = getRecords(companiesRes.value);
          companiesById = mapByKeys(companies, ["id"]);
        } else {
          warnings.push({
            code: "context_fetch_warning",
            message: `No se pudieron obtener companias del proyecto: ${String(
              companiesRes.reason
            )}`,
            source: "acc_files_folder_permissions_get"
          });
        }
      }

      const enrichedPermissions = enrichPermissions({
        permissions,
        usersById,
        companiesById,
        rolesById,
        users
      });

      if (enrichedPermissions.length === 0) {
        warnings.push({
          code: "no_permissions",
          message: "La carpeta no devolvio permisos visibles.",
          source: "acc_files_folder_permissions_get"
        });
      }

      if (args.includeContext) {
        context.users = users;
        context.companies = companies;
      }
      if (args.includeContext && args.includeDictionaries) {
        dictionaries.usersById = usersById;
        dictionaries.companiesById = companiesById;
        dictionaries.rolesById = rolesById;
      }

      const payload = finalizePayload(
        buildMcpResponse({
          results: enrichedPermissions,
          pagination: {
            totalResults: enrichedPermissions.length,
            returned: enrichedPermissions.length,
            offset: 0,
            hasMore: false,
            nextOffset: null
          },
          meta: {
            tool: "acc_files_folder_permissions_get",
            generatedAt: new Date().toISOString(),
            source: "bim360/docs/v1/projects/:project_id/folders/:folder_id/permissions",
            projectResolution: {
              source: resolvedProject.source,
              hubId: resolvedProject.hubId,
              requestedProjectName: resolvedProject.requestedProjectName,
              resolvedProjectName: resolvedProject.resolvedProjectName,
              rawProjectId: resolvedProject.rawProjectId,
              filesProjectIdWithB: projectIdWithB,
              filesProjectIdWithoutB: projectIdWithoutB
            },
            folderResolution,
            options: {
              maxFoldersScan: args.maxFoldersScan,
              includeContext: args.includeContext,
              includeDictionaries: args.includeDictionaries
            },
            ...(args.includeContext ? { context } : {}),
            ...(args.includeContext && args.includeDictionaries ? { dictionaries } : {})
          },
          warnings
        }) as Record<string, unknown>
      );

      return {
        content: [{ type: "text", text: stringifyMcpPayload(payload) }]
      };
    }
  );
}
