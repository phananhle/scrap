import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const listMyScraps = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const scraps = await ctx.db
      .query("scraps")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .collect();
    scraps.reverse();

    const result = [];
    for (const scrap of scraps) {
      const videoUrl = await ctx.storage.getUrl(scrap.videoStorageId);
      const photoDocs = await ctx.db
        .query("photos")
        .withIndex("by_scrap", (q) => q.eq("scrapId", scrap._id))
        .collect();
      const photos = [];
      for (const photo of photoDocs) {
        const imageUrl = await ctx.storage.getUrl(photo.imageStorageId);
        if (imageUrl) photos.push({ _id: photo._id, imageUrl });
      }
      result.push({
        _id: scrap._id,
        timestamp: scrap.timestamp,
        videoUrl,
        photos,
      });
    }
    return result;
  },
});
