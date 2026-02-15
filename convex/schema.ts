import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    pokeApiKey: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

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
