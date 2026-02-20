import { createOffsetPaginationInputSchema } from "@tad/shared";

export const DmPaginationSchema = createOffsetPaginationInputSchema({
  includeFetchAll: false,
  limitDescription: "Cantidad maxima de proyectos a devolver por pagina."
});
