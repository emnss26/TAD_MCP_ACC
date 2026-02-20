import { createOffsetPaginationInputSchema } from "@tad/shared";

export const SubmittalsPaginationSchema = createOffsetPaginationInputSchema({
  maxItemsDescription: "Maximo de submittals al usar fetchAll."
});
