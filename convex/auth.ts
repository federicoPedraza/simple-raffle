import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Buscar vendedor por nombre
export const findSellerByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const sellers = await ctx.db
      .query("sellers")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .collect();

    return sellers.length > 0 ? sellers[0] : null;
  },
});

// Crear nuevo vendedor
export const createSeller = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sellers")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    const sellerId = await ctx.db.insert("sellers", {
      name: args.name,
      createdAt: Date.now(),
    });

    return sellerId;
  },
});

// Obtener vendedor por ID
export const getSeller = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sellerId);
  },
});
