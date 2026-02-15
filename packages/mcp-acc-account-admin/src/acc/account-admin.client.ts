import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

const CONSTRUCTION_ADMIN_BASE_URL =
  "https://developer.api.autodesk.com/construction/admin/v1";
const HQ_BASE_URL = "https://developer.api.autodesk.com/hq/v1";

type QueryValue = string | number | boolean | null | undefined;

type ListParams = {
  token: string;
  limit: number;
  offset: number;
  region?: string;
  query?: Record<string, QueryValue>;
};

type AccountListParams = ListParams & {
  accountId: string;
};

type ProjectListParams = ListParams & {
  projectId: string;
};

type AccountProjectCompaniesParams = ListParams & {
  accountId: string;
  projectId: string;
};

type PatchCompanyParams = {
  token: string;
  accountId: string;
  companyId: string;
  payload: Record<string, unknown>;
  region?: string;
};

type PatchUserParams = {
  token: string;
  accountId: string;
  userId: string;
  payload: Record<string, unknown>;
  region?: string;
};

function appendQuery(
  url: URL,
  params: Record<string, QueryValue> = {}
) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
}

function buildHeaders(region?: string): Record<string, string> | undefined {
  if (!region) return undefined;
  return { Region: region };
}

export async function getAccountProjects(params: AccountListParams) {
  const { token, accountId, limit, offset, region, query } = params;
  const url = new URL(
    `${CONSTRUCTION_ADMIN_BASE_URL}/accounts/${accountId}/projects`
  );
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    headers: buildHeaders(region),
    serviceName: "accountAdmin.getAccountProjects"
  });
}

export async function getAccountCompanies(params: AccountListParams) {
  const { token, accountId, limit, offset, region, query } = params;
  const url = new URL(
    `${CONSTRUCTION_ADMIN_BASE_URL}/accounts/${accountId}/companies`
  );
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    headers: buildHeaders(region),
    serviceName: "accountAdmin.getAccountCompanies"
  });
}

export async function getProjectCompaniesByAccount(
  params: AccountProjectCompaniesParams
) {
  const { token, accountId, projectId, limit, offset, region, query } = params;
  const url = new URL(
    `${HQ_BASE_URL}/accounts/${accountId}/projects/${projectId}/companies`
  );
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    headers: buildHeaders(region),
    serviceName: "accountAdmin.getProjectCompaniesByAccount"
  });
}

export async function getAccountUsers(params: AccountListParams) {
  const { token, accountId, limit, offset, region, query } = params;
  const url = new URL(`${HQ_BASE_URL}/accounts/${accountId}/users`);
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    headers: buildHeaders(region),
    serviceName: "accountAdmin.getAccountUsers"
  });
}

export async function getProjectUsers(params: ProjectListParams) {
  const { token, projectId, limit, offset, region, query } = params;
  const url = new URL(`${CONSTRUCTION_ADMIN_BASE_URL}/projects/${projectId}/users`);
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    headers: buildHeaders(region),
    serviceName: "accountAdmin.getProjectUsers"
  });
}

export async function patchCompanyDetails(params: PatchCompanyParams) {
  const { token, accountId, companyId, payload, region } = params;
  return fetchApsJson(`${HQ_BASE_URL}/accounts/${accountId}/companies/${companyId}`, {
    method: "PATCH",
    token,
    headers: buildHeaders(region),
    body: payload,
    serviceName: "accountAdmin.patchCompanyDetails"
  });
}

export async function patchUserDetails(params: PatchUserParams) {
  const { token, accountId, userId, payload, region } = params;
  return fetchApsJson(`${HQ_BASE_URL}/accounts/${accountId}/users/${userId}`, {
    method: "PATCH",
    token,
    headers: buildHeaders(region),
    body: payload,
    serviceName: "accountAdmin.patchUserDetails"
  });
}
