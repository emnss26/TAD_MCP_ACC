import { createOffsetPaginationInputSchema } from "@tad/shared";

export const TransmittalsPaginationSchema = createOffsetPaginationInputSchema({
  maxItemsDescription: "Maximo de transmittals al usar fetchAll."
});
