import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});

export const get = query({
  args: { teamId: v.number() },
  handler: async (ctx, { teamId }) => {
    return await ctx.db
      .query("teams")
      .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
      .unique();
  },
});
