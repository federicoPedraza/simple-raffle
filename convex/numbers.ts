import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Registrar número
export const registerNumber = mutation({
  args: {
    number: v.string(),
    raffleId: v.id("raffles"),
    sellerId: v.id("sellers"),
    buyerName: v.string(),
    buyerContact: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar que el número no esté ya registrado en esta rifa
    const existing = await ctx.db
      .query("numbers")
      .withIndex("by_raffle_and_number", (q) =>
        q.eq("raffleId", args.raffleId).eq("number", args.number)
      )
      .first();

    if (existing) {
      throw new Error("Este número ya está registrado en esta rifa");
    }

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

    return await ctx.db.insert("numbers", {
      number: args.number,
      raffleId: args.raffleId,
      sellerId: args.sellerId,
      buyerName: args.buyerName,
      buyerContact: args.buyerContact,
      createdAt: Date.now(),
    });
  },
});

// Buscar números con paginación
export const searchNumbers = query({
  args: {
    raffleId: v.id("raffles"),
    searchTerm: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("numbers")
      .withIndex("by_raffle", (q) => q.eq("raffleId", args.raffleId));

    const allNumbers = await query.collect();

    // Filtrar por término de búsqueda si existe
    let filtered = allNumbers;
    if (args.searchTerm && args.searchTerm.trim()) {
      const searchLower = args.searchTerm.toLowerCase();
      filtered = allNumbers.filter(
        (n) =>
          n.number.toLowerCase().includes(searchLower) ||
          n.buyerName.toLowerCase().includes(searchLower) ||
          n.buyerContact.toLowerCase().includes(searchLower)
      );
    }

    // Ordenar por fecha de creación (más recientes primero)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Paginación simple
    const numItems = args.paginationOpts?.numItems || 20;
    const cursor = args.paginationOpts?.cursor
      ? parseInt(args.paginationOpts.cursor)
      : 0;

    const paginated = filtered.slice(cursor, cursor + numItems);
    const hasMore = cursor + numItems < filtered.length;

    return {
      results: paginated,
      isDone: !hasMore,
      nextCursor: hasMore ? (cursor + numItems).toString() : undefined,
    };
  },
});

// Obtener número por ID
export const getNumber = query({
  args: { numberId: v.id("numbers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.numberId);
  },
});

// Obtener números de una rifa (sin paginación, para conteos)
export const getNumbersByRaffle = query({
  args: { raffleId: v.id("raffles") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("numbers")
      .withIndex("by_raffle", (q) => q.eq("raffleId", args.raffleId))
      .collect();
  },
});
