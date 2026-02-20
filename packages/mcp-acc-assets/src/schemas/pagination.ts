import { createOffsetPaginationInputSchema } from "@tad/shared";

export const AssetsPaginationSchema = createOffsetPaginationInputSchema({
  maxItemsDescription: "Maximo de assets al usar fetchAll."
});
