import { createOffsetPaginationInputSchema } from "@tad/shared";

export const IssuesPaginationSchema = createOffsetPaginationInputSchema({
  maxItemsDescription: "Maximo de issues al usar fetchAll."
});
