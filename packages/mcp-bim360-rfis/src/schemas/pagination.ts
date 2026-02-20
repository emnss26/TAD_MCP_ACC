import { createOffsetPaginationInputSchema } from "@tad/shared";

export const RfisPaginationSchema = createOffsetPaginationInputSchema({
  maxItemsDescription: "Maximo de RFIs al usar fetchAll."
});
