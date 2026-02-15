import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const createScrap = mutation({
  args: {
    videoStorageId: v.id("_storage"),
    timestamp: v.number(),
    photoStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Placeholder: get or create default user for MVP (replace with auth later)
    let user = await ctx.db.query("users").first();
    if (!user) {
      const userId = await ctx.db.insert("users", {});
      user = await ctx.db.get(userId);
    }
    if (!user) throw new Error("Could not get or create user");

    const scrapId = await ctx.db.insert("scraps", {
      userId: user._id,
      videoStorageId: args.videoStorageId,
      timestamp: args.timestamp,
    });

    for (const imageStorageId of args.photoStorageIds) {
      await ctx.db.insert("photos", {
        scrapId,
        imageStorageId,
      });
    }

    return scrapId;
  },
});
