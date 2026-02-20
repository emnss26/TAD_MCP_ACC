import { createOffsetPaginationInputSchema } from "@tad/shared";

export const SheetsPaginationInputSchema = createOffsetPaginationInputSchema({
  maxItemsDescription: "Maximo de elementos al usar fetchAll."
});
