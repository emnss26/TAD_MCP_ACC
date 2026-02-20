import { createOffsetPaginationInputSchema } from "@tad/shared";

export const AccountAdminPaginationInputSchema = createOffsetPaginationInputSchema({
  maxItemsMax: 10000,
  maxItemsDefault: 2000,
  maxItemsDescription: "Maximo de elementos al usar fetchAll."
});
