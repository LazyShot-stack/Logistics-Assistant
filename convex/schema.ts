import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  suppliers: defineTable({
    name: v.string(),
    location: v.string(),
    reliabilityScore: v.number(), // 0-100
    averageDeliveryDays: v.number(),
    contactEmail: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }),

  products: defineTable({
    name: v.string(),
    sku: v.string(),
    category: v.string(),
    unitPrice: v.number(),
    reorderPoint: v.number(),
    reorderQuantity: v.number(),
    supplierId: v.id("suppliers"),
  }).index("by_supplier", ["supplierId"])
    .index("by_sku", ["sku"]),

  inventory: defineTable({
    productId: v.id("products"),
    currentStock: v.number(),
    reservedStock: v.number(),
    availableStock: v.number(),
    lastUpdated: v.number(),
    warehouseLocation: v.string(),
  }).index("by_product", ["productId"])
    .index("by_warehouse", ["warehouseLocation"]),

  shipments: defineTable({
    supplierId: v.id("suppliers"),
    productId: v.id("products"),
    quantity: v.number(),
    orderDate: v.number(),
    expectedDeliveryDate: v.number(),
    actualDeliveryDate: v.optional(v.number()),
    status: v.union(
      v.literal("ordered"),
      v.literal("in_transit"),
      v.literal("delivered"),
      v.literal("delayed"),
      v.literal("cancelled")
    ),
    trackingNumber: v.optional(v.string()),
    delayReason: v.optional(v.string()),
  }).index("by_supplier", ["supplierId"])
    .index("by_product", ["productId"])
    .index("by_status", ["status"])
    .index("by_expected_delivery", ["expectedDeliveryDate"]),

  queries: defineTable({
    userId: v.id("users"),
    question: v.string(),
    response: v.string(),
    insights: v.array(v.string()),
    recommendations: v.array(v.string()),
    timestamp: v.number(),
  }).index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  alerts: defineTable({
    type: v.union(
      v.literal("low_stock"),
      v.literal("supplier_delay"),
      v.literal("quality_issue"),
      v.literal("reorder_needed")
    ),
    title: v.string(),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    productId: v.optional(v.id("products")),
    supplierId: v.optional(v.id("suppliers")),
    isResolved: v.boolean(),
    createdAt: v.number(),
  }).index("by_severity", ["severity"])
    .index("by_type", ["type"])
    .index("by_resolved", ["isResolved"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
