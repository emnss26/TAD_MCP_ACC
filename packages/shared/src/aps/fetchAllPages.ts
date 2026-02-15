export type PaginatedResponse<TItem = unknown> = {
  results?: TItem[];
  pagination?: Record<string, unknown>;
  [key: string]: unknown;
};

export type FetchAllPagesOptions<
  TPage extends PaginatedResponse<TItem>,
  TItem = unknown
> = {
  fetchAll: boolean;
  limit: number;
  offset: number;
  maxPages: number;
  maxItems: number;
  fetchPage: (params: { limit: number; offset: number }) => Promise<TPage>;
};

export async function fetchAllPages<
  TPage extends PaginatedResponse<TItem>,
  TItem = unknown
>(options: FetchAllPagesOptions<TPage, TItem>): Promise<TPage> {
  if (!options.fetchAll) {
    return options.fetchPage({
      limit: options.limit,
      offset: options.offset
    });
  }

  const results: TItem[] = [];
  let currentOffset = options.offset;
  let pageCount = 0;
  let hasMore = false;
  let lastPage: TPage | null = null;

  while (pageCount < options.maxPages && results.length < options.maxItems) {
    const pageLimit = Math.min(options.limit, options.maxItems - results.length);
    const data = await options.fetchPage({ limit: pageLimit, offset: currentOffset });
    const pageResults = Array.isArray(data?.results) ? data.results : [];

    results.push(...pageResults);
    pageCount += 1;
    lastPage = data;

    if (pageResults.length < pageLimit) {
      hasMore = false;
      break;
    }

    currentOffset += pageResults.length;
    hasMore = true;
  }

  return {
    ...(lastPage ?? ({} as TPage)),
    results,
    pagination: {
      ...(lastPage?.pagination ?? {}),
      offset: options.offset,
      limit: options.limit,
      fetchAll: options.fetchAll,
      maxPages: options.maxPages,
      maxItems: options.maxItems,
      fetchedPages: pageCount,
      fetchedItems: results.length,
      hasMore,
      nextOffset: hasMore ? currentOffset : null
    }
  } as TPage;
}
