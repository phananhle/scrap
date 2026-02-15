import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    pokeApiKey: v.optional(v.string()),
  }),

  scraps: defineTable({
    userId: v.id("users"),
    videoStorageId: v.id("_storage"),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  photos: defineTable({
    scrapId: v.id("scraps"),
    imageStorageId: v.id("_storage"),
    metadata: v.optional(v.string()), // placeholder for future metadata
  }).index("by_scrap", ["scrapId"]),
});
