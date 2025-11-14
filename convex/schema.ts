import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  raffles: defineTable({
    amountOfNumbers: v.number(),
    state: v.union(v.literal("waiting"), v.literal("started"), v.literal("complete")),
    price: v.number(),
    createdAt: v.number(),
    createdBy: v.id("sellers"),
  })
    .index("by_state", ["state"])
    .index("by_created_by", ["createdBy"]),

  sellers: defineTable({
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_name", ["name"]),

  sellerRaffles: defineTable({
    sellerId: v.id("sellers"),
    raffleId: v.id("raffles"),
    role: v.union(v.literal("owner"), v.literal("moderator"), v.literal("seller")),
    createdAt: v.number(),
  })
    .index("by_seller", ["sellerId"])
    .index("by_raffle", ["raffleId"])
    .index("by_seller_and_raffle", ["sellerId", "raffleId"]),

  numbers: defineTable({
    number: v.string(),
    raffleId: v.id("raffles"),
    sellerId: v.id("sellers"),
    buyerName: v.string(),
    buyerContact: v.string(),
    createdAt: v.number(),
  })
    .index("by_raffle", ["raffleId"])
    .index("by_seller", ["sellerId"])
    .index("by_raffle_and_number", ["raffleId", "number"])
    .index("by_raffle_and_buyer", ["raffleId", "buyerName", "buyerContact"]),

  chatMessages: defineTable({
    raffleId: v.id("raffles"),
    sellerId: v.id("sellers"),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_raffle", ["raffleId"])
    .index("by_raffle_and_created", ["raffleId", "createdAt"]),
});
