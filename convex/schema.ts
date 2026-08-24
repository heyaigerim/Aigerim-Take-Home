import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teams: defineTable({
    teamId: v.number(),
    teamName: v.string(),
    createdAt: v.string(),
    plan: v.string(),
    region: v.string(),
    contactEmail: v.string(),
    memberCount: v.number(),
    projectCount: v.number(),
    prodDeploymentCount: v.number(),
    deploymentCount: v.number(),
    largestDeploymentClass: v.string(),
    suspended: v.boolean(),
    hasConvexEmployeeMember: v.boolean(),
  }).index("by_teamId", ["teamId"]),

  usageDaily: defineTable({
    teamId: v.number(),
    date: v.string(),
    functionCalls: v.number(),
    queryExecutionMs: v.number(),
    peakConcurrentQueries: v.number(),
    dbBandwidthGb: v.number(),
    dbStorageGb: v.number(),
  }).index("by_teamId_date", ["teamId", "date"]),
});
