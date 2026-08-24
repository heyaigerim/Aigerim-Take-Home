import { query } from "./_generated/server";
import { v } from "convex/values";

export const forTeam = query({
  args: { teamId: v.number() },
  handler: async (ctx, { teamId }) => {
    return await ctx.db
      .query("usageDaily")
      .withIndex("by_teamId_date", (q) => q.eq("teamId", teamId))
      .collect();
  },
});
