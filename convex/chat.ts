import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Enviar mensaje al chat
export const sendMessage = mutation({
  args: {
    raffleId: v.id("raffles"),
    sellerId: v.id("sellers"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar que el vendedor tenga acceso a la rifa
    const sellerRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.sellerId).eq("raffleId", args.raffleId)
      )
      .first();

    if (!sellerRaffle) {
      throw new Error("No tienes acceso a esta rifa");
    }

    if (!args.message.trim()) {
      throw new Error("El mensaje no puede estar vacío");
    }

    return await ctx.db.insert("chatMessages", {
      raffleId: args.raffleId,
      sellerId: args.sellerId,
      message: args.message.trim(),
      createdAt: Date.now(),
    });
  },
});

// Obtener mensajes del chat de una rifa
export const getMessages = query({
  args: {
    raffleId: v.id("raffles"),
    sellerId: v.id("sellers"),
  },
  handler: async (ctx, args) => {
    // Verificar que el vendedor tenga acceso a la rifa
    const sellerRaffle = await ctx.db
      .query("sellerRaffles")
      .withIndex("by_seller_and_raffle", (q) =>
        q.eq("sellerId", args.sellerId).eq("raffleId", args.raffleId)
      )
      .first();

    if (!sellerRaffle) {
      return [];
    }

    // Obtener mensajes ordenados por fecha (más antiguos primero)
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_raffle", (q) => q.eq("raffleId", args.raffleId))
      .order("asc")
      .collect();

    // Obtener información de los vendedores
    const messagesWithSellers = await Promise.all(
      messages.map(async (msg) => {
        const seller = await ctx.db.get(msg.sellerId);
        return {
          ...msg,
          sellerName: seller?.name || "Desconocido",
        };
      })
    );

    return messagesWithSellers;
  },
});
