import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation(async (ctx) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Must be signed in to upload");
  return await ctx.storage.generateUploadUrl();
});

export const createScrap = mutation({
  args: {
    videoStorageId: v.id("_storage"),
    timestamp: v.number(),
    photoStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be signed in to create a scrap");

    const scrapId = await ctx.db.insert("scraps", {
      userId,
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
