import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Crear rifa
export const createRaffle = mutation({
  args: {
    amountOfNumbers: v.number(),
    price: v.number(),
    createdBy: v.id("sellers"),
    sellerIds: v.array(v.id("sellers")),
    roles: v.array(v.union(v.literal("owner"), v.literal("moderator"), v.literal("seller"))),
  },
  handler: async (ctx, args) => {
    const raffleId = await ctx.db.insert("raffles", {
      amountOfNumbers: args.amountOfNumbers,
      state: "waiting",
      price: args.price,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });

    // Asignar vendedores a la rifa
    for (let i = 0; i < args.sellerIds.length; i++) {
      await ctx.db.insert("sellerRaffles", {
        sellerId: args.sellerIds[i],
        raffleId,
        role: args.roles[i],
        createdAt: Date.now(),
      });
    }

    return raffleId;
  },
});

// Obtener todas las rifas
export const getAllRaffles = query({
  handler: async (ctx) => {
    return await ctx.db.query("raffles").order("desc").collect();
  },
});

// Obtener rifa por ID
export const getRaffle = query({
  args: { raffleId: v.id("raffles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.raffleId);
  },
});

// Obtener rifas de un vendedor
export const getRafflesBySeller = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    const sellerRaffles = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();

    const raffles = await Promise.all(
      sellerRaffles.map(async (sr) => {
        const raffle = await ctx.db.get(sr.raffleId);
        return { ...raffle, role: sr.role };
      })
    );

    return raffles.filter((r) => r !== null);
  },
});

// Obtener vendedores de una rifa
export const getSellersByRaffle = query({
  args: { raffleId: v.id("raffles") },
  handler: async (ctx, args) => {
    const sellerRaffles = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_raffle", (q) => q.eq("raffleId", args.raffleId))
      .collect();

    const sellers = await Promise.all(
      sellerRaffles.map(async (sr) => {
        const seller = await ctx.db.get(sr.sellerId);
        return seller ? { ...seller, role: sr.role } : null;
      })
    );

    return sellers.filter((s) => s !== null);
  },
});

// Buscar vendedores por nombre
export const searchSellers = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      return [];
    }

    const allSellers = await ctx.db.query("sellers").collect();
    const searchLower = args.searchTerm.toLowerCase();

    return allSellers.filter((seller) =>
      seller.name.toLowerCase().includes(searchLower)
    );
  },
});

// Asignar vendedor a rifa
export const assignSellerToRaffle = mutation({
  args: {
    sellerId: v.id("sellers"),
    raffleId: v.id("raffles"),
    role: v.union(v.literal("owner"), v.literal("moderator"), v.literal("seller")),
    requesterId: v.id("sellers"),
  },
  handler: async (ctx, args) => {
    // Verificar permisos del solicitante (solo owner o moderator)
    const requesterRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.requesterId).eq("raffleId", args.raffleId)
      )
      .first();

    if (!requesterRaffle || (requesterRaffle.role !== "owner" && requesterRaffle.role !== "moderator")) {
      throw new Error("No tienes permisos para gestionar vendedores");
    }

    // Verificar si ya existe
    const existing = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.sellerId).eq("raffleId", args.raffleId)
      )
      .first();

    if (existing) {
      // Actualizar rol si ya existe
      await ctx.db.patch(existing._id, {
        role: args.role,
      });
      return existing._id;
    }

    return await ctx.db.insert("sellerRaffles", {
      sellerId: args.sellerId,
      raffleId: args.raffleId,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

// Remover vendedor de rifa
export const removeSellerFromRaffle = mutation({
  args: {
    sellerId: v.id("sellers"),
    raffleId: v.id("raffles"),
    requesterId: v.id("sellers"),
  },
  handler: async (ctx, args) => {
    // Verificar permisos del solicitante (solo owner o moderator)
    const requesterRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.requesterId).eq("raffleId", args.raffleId)
      )
      .first();

    if (!requesterRaffle || (requesterRaffle.role !== "owner" && requesterRaffle.role !== "moderator")) {
      throw new Error("No tienes permisos para gestionar vendedores");
    }

    // No permitir que un owner se elimine a sí mismo
    if (args.sellerId === args.requesterId && requesterRaffle.role === "owner") {
      throw new Error("No puedes eliminarte a ti mismo como owner");
    }

    // Buscar y eliminar la relación
    const sellerRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.sellerId).eq("raffleId", args.raffleId)
      )
      .first();

    if (sellerRaffle) {
      await ctx.db.delete(sellerRaffle._id);
    }
  },
});

// Cambiar estado de rifa
export const updateRaffleState = mutation({
  args: {
    raffleId: v.id("raffles"),
    state: v.union(v.literal("waiting"), v.literal("started"), v.literal("complete")),
    sellerId: v.id("sellers"),
  },
  handler: async (ctx, args) => {
    // Verificar permisos (solo owner o moderator)
    const sellerRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.sellerId).eq("raffleId", args.raffleId)
      )
      .first();

    if (!sellerRaffle || (sellerRaffle.role !== "owner" && sellerRaffle.role !== "moderator")) {
      throw new Error("No tienes permisos para cambiar el estado de la rifa");
    }

    await ctx.db.patch(args.raffleId, {
      state: args.state,
    });
  },
});

// Verificar rol de vendedor en rifa
export const getSellerRole = query({
  args: {
    sellerId: v.id("sellers"),
    raffleId: v.id("raffles"),
  },
  handler: async (ctx, args) => {
    const sellerRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.sellerId).eq("raffleId", args.raffleId)
      )
      .first();

    return sellerRaffle ? sellerRaffle.role : null;
  },
});
