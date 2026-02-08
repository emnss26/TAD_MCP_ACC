export async function listIssues(params: {
    token: string;
    projectId: string;
    limit: number;
    offset: number;
}) {
    const { token, projectId, limit, offset } = params;

    const url = new URL(`https://developer.api.autodesk.com/construction/issues/v1/projects/${projectId}/issues`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ACC Issues API error ${res.status}: ${body}`);
    }
    return res.json();
}