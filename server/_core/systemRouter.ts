import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { purgeOldRuns } from "./retention";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  runRetentionJob: adminProcedure
    .input(z.object({ daysOld: z.number().min(1).default(30) }).default({ daysOld: 30 }))
    .mutation(async ({ input }) => {
      const purgedCount = await purgeOldRuns(input.daysOld);
      return { success: true, purgedCount } as const;
    }),
});
