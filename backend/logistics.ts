import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

// Query functions for dashboard data
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [suppliers, products, shipments, alerts] = await Promise.all([
      ctx.db.query("suppliers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("shipments").collect(),
      ctx.db.query("alerts").filter(q => q.eq(q.field("isResolved"), false)).collect(),
    ]);

    const activeShipments = shipments.filter(s => s.status === "in_transit" || s.status === "ordered");
    const delayedShipments = shipments.filter(s => s.status === "delayed");
    const avgReliability = suppliers.reduce((sum, s) => sum + s.reliabilityScore, 0) / suppliers.length;

    return {
      totalSuppliers: suppliers.length,
      totalProducts: products.length,
      activeShipments: activeShipments.length,
      delayedShipments: delayedShipments.length,
      avgSupplierReliability: Math.round(avgReliability),
      activeAlerts: alerts.length,
    };
  },
});

export const getSuppliers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db.query("suppliers").collect();
  },
});

export const getProducts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const products = await ctx.db.query("products").collect();
    const productsWithSuppliers = await Promise.all(
      products.map(async (product) => {
        const supplier = await ctx.db.get(product.supplierId);
        return { ...product, supplierName: supplier?.name || "Unknown" };
      })
    );
    
    return productsWithSuppliers;
  },
});

export const getInventoryStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const inventory = await ctx.db.query("inventory").collect();
    const inventoryWithProducts = await Promise.all(
      inventory.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { 
          ...item, 
          productName: product?.name || "Unknown",
          productSku: product?.sku || "Unknown",
          reorderPoint: product?.reorderPoint || 0,
          needsReorder: item.availableStock <= (product?.reorderPoint || 0)
        };
      })
    );
    
    return inventoryWithProducts;
  },
});

export const getShipments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const shipments = await ctx.db.query("shipments").order("desc").take(50);
    const shipmentsWithDetails = await Promise.all(
      shipments.map(async (shipment) => {
        const [supplier, product] = await Promise.all([
          ctx.db.get(shipment.supplierId),
          ctx.db.get(shipment.productId),
        ]);
        return {
          ...shipment,
          supplierName: supplier?.name || "Unknown",
          productName: product?.name || "Unknown",
          productSku: product?.sku || "Unknown",
        };
      })
    );
    
    return shipmentsWithDetails;
  },
});

export const getAlerts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db.query("alerts")
      .filter(q => q.eq(q.field("isResolved"), false))
      .order("desc")
      .take(20);
  },
});

export const getQueryHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db.query("queries")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});

// Smart query processing using rule-based analysis
export const processQuery = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get relevant data for context
    const [suppliers, products, shipments, inventory, alerts] = await Promise.all([
      ctx.runQuery(api.logistics.getSuppliers),
      ctx.runQuery(api.logistics.getProducts),
      ctx.runQuery(api.logistics.getShipments),
      ctx.runQuery(api.logistics.getInventoryStatus),
      ctx.runQuery(api.logistics.getAlerts),
    ]);

    // Analyze the question and generate insights
    const analysis = analyzeSupplyChainQuery(
      args.question,
      suppliers,
      products,
      shipments,
      inventory,
      alerts,
    );

    // Save the query and response
    await ctx.runMutation(api.logistics.saveQuery, {
      question: args.question,
      response: analysis.response,
      insights: analysis.insights,
      recommendations: analysis.recommendations,
    });

    return analysis;
  },
});

// Rule-based analysis function
function analyzeSupplyChainQuery(
  question: string,
  suppliers: any[],
  products: any[],
  shipments: any[],
  inventory: any[],
  alerts: any[]
): any {
  const lowerQuestion = question.toLowerCase();
  let response = "";
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Analyze supplier delays
  if (lowerQuestion.includes("delay") || lowerQuestion.includes("delayed")) {
    const delayedShipments = shipments.filter(s => s.status === "delayed");
    const delayedSuppliers = [...new Set(delayedShipments.map(s => s.supplierName))];
    
    if (delayedShipments.length > 0) {
      response = `Found ${delayedShipments.length} delayed shipments.`;
      insights.push(`${delayedSuppliers.length} suppliers have delayed shipments`);
      insights.push(`Most common delay reason: ${getMostCommonDelayReason(delayedShipments)}`);
      recommendations.push("Contact delayed suppliers for updated delivery timelines");
      recommendations.push("Consider alternative suppliers for critical items");
    } else {
      response = "No delayed shipments found in the system.";
    }
  }

  // Analyze reorder needs
  else if (lowerQuestion.includes("reorder") || lowerQuestion.includes("stock")) {
    const lowStockItems = inventory.filter(item => item.needsReorder);
    
    if (lowStockItems.length > 0) {
      response = `Found ${lowStockItems.length} items that need reordering.`;
      insights.push(`${lowStockItems.length} products are below reorder points`);
      insights.push(`Total value of items needing reorder: $${calculateReorderValue(lowStockItems, products)}`);
      recommendations.push("Place orders for low stock items immediately");
      recommendations.push("Review reorder points for frequently low items");
    } else {
      response = "All inventory levels are above reorder points.";
    }
  }

  // Analyze supplier reliability
  else if (lowerQuestion.includes("reliability") || lowerQuestion.includes("reliable")) {
    const lowReliabilitySuppliers = suppliers.filter(s => s.reliabilityScore < 70);
    const avgReliability = suppliers.reduce((sum, s) => sum + s.reliabilityScore, 0) / suppliers.length;
    
    response = `Average supplier reliability is ${Math.round(avgReliability)}%.`;
    insights.push(`${lowReliabilitySuppliers.length} suppliers have reliability below 70%`);
    if (lowReliabilitySuppliers.length > 0) {
      insights.push(`Lowest reliability supplier: ${lowReliabilitySuppliers[0].name} (${lowReliabilitySuppliers[0].reliabilityScore}%)`);
      recommendations.push("Review contracts with low reliability suppliers");
      recommendations.push("Develop backup supplier relationships");
    }
  }

  // Analyze inventory levels
  else if (lowerQuestion.includes("inventory") || lowerQuestion.includes("stock level")) {
    const totalItems = inventory.length;
    const lowStockCount = inventory.filter(item => item.needsReorder).length;
    const outOfStockCount = inventory.filter(item => item.availableStock === 0).length;
    
    response = `Current inventory status: ${totalItems} total items, ${lowStockCount} need reorder, ${outOfStockCount} out of stock.`;
    insights.push(`${((lowStockCount / totalItems) * 100).toFixed(1)}% of items need reordering`);
    if (outOfStockCount > 0) {
      insights.push(`${outOfStockCount} items are completely out of stock`);
      recommendations.push("Urgently reorder out-of-stock items");
    }
  }

  // Analyze active shipments
  else if (lowerQuestion.includes("shipment") || lowerQuestion.includes("delivery")) {
    const activeShipments = shipments.filter(s => s.status === "in_transit" || s.status === "ordered");
    const upcomingDeliveries = shipments.filter(s => 
      s.expectedDeliveryDate > Date.now() && 
      s.expectedDeliveryDate < Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    
    response = `There are ${activeShipments.length} active shipments.`;
    insights.push(`${upcomingDeliveries.length} deliveries expected this week`);
    if (upcomingDeliveries.length > 0) {
      insights.push(`Next delivery: ${upcomingDeliveries[0].productName} from ${upcomingDeliveries[0].supplierName}`);
    }
  }

  // Default response for unrecognized queries
  else {
    response = "I've analyzed your supply chain data. Here's what I found:";
    insights.push(`Total suppliers: ${suppliers.length}`);
    insights.push(`Total products: ${products.length}`);
    insights.push(`Active shipments: ${shipments.filter(s => s.status === "in_transit" || s.status === "ordered").length}`);
    insights.push(`Active alerts: ${alerts.length}`);
    recommendations.push("Review dashboard metrics for detailed insights");
    recommendations.push("Check alerts for any urgent issues");
  }

  return {
    response,
    insights,
    recommendations,
  };
}

// Helper functions
function getMostCommonDelayReason(shipments: any[]): string {
  const reasons = shipments.map(s => s.delayReason).filter(Boolean);
  if (reasons.length === 0) return "Unknown";
  
  const counts: { [key: string]: number } = {};
  reasons.forEach(reason => {
    counts[reason] = (counts[reason] || 0) + 1;
  });
  
  return Object.entries(counts).sort(([,a], [,b]) => b - a)[0][0];
}

function calculateReorderValue(lowStockItems: any[], products: any[]): number {
  return lowStockItems.reduce((total, item) => {
    const product = products.find(p => p._id === item.productId);
    const reorderQuantity = product?.reorderQuantity || 0;
    const unitPrice = product?.unitPrice || 0;
    return total + (reorderQuantity * unitPrice);
  }, 0);
}

export const saveQuery = mutation({
  args: {
    question: v.string(),
    response: v.string(),
    insights: v.array(v.string()),
    recommendations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("queries", {
      userId,
      question: args.question,
      response: args.response,
      insights: args.insights,
      recommendations: args.recommendations,
      timestamp: Date.now(),
    });
  },
});

// Initialize sample data
export const initializeSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if data already exists
    const existingSuppliers = await ctx.db.query("suppliers").first();
    if (existingSuppliers) return { message: "Sample data already exists" };

    // Create sample suppliers
    const supplier1 = await ctx.db.insert("suppliers", {
      name: "Global Electronics Co.",
      location: "Shenzhen, China",
      reliabilityScore: 85,
      averageDeliveryDays: 14,
      contactEmail: "orders@globalelectronics.com",
      status: "active",
    });

    const supplier2 = await ctx.db.insert("suppliers", {
      name: "FastTrack Logistics",
      location: "Los Angeles, USA",
      reliabilityScore: 92,
      averageDeliveryDays: 7,
      contactEmail: "support@fasttrack.com",
      status: "active",
    });

    const supplier3 = await ctx.db.insert("suppliers", {
      name: "EuroTech Solutions",
      location: "Berlin, Germany",
      reliabilityScore: 78,
      averageDeliveryDays: 21,
      contactEmail: "sales@eurotech.de",
      status: "active",
    });

    // Create sample products
    const product1 = await ctx.db.insert("products", {
      name: "Wireless Headphones",
      sku: "WH-001",
      category: "Electronics",
      unitPrice: 89.99,
      reorderPoint: 50,
      reorderQuantity: 200,
      supplierId: supplier1,
    });

    const product2 = await ctx.db.insert("products", {
      name: "Smartphone Case",
      sku: "SC-002",
      category: "Accessories",
      unitPrice: 24.99,
      reorderPoint: 100,
      reorderQuantity: 500,
      supplierId: supplier2,
    });

    const product3 = await ctx.db.insert("products", {
      name: "Bluetooth Speaker",
      sku: "BS-003",
      category: "Electronics",
      unitPrice: 149.99,
      reorderPoint: 25,
      reorderQuantity: 100,
      supplierId: supplier3,
    });

    // Create sample inventory
    await ctx.db.insert("inventory", {
      productId: product1,
      currentStock: 45,
      reservedStock: 10,
      availableStock: 35,
      lastUpdated: Date.now(),
      warehouseLocation: "Warehouse A",
    });

    await ctx.db.insert("inventory", {
      productId: product2,
      currentStock: 250,
      reservedStock: 50,
      availableStock: 200,
      lastUpdated: Date.now(),
      warehouseLocation: "Warehouse B",
    });

    await ctx.db.insert("inventory", {
      productId: product3,
      currentStock: 15,
      reservedStock: 5,
      availableStock: 10,
      lastUpdated: Date.now(),
      warehouseLocation: "Warehouse A",
    });

    // Create sample shipments
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    await ctx.db.insert("shipments", {
      supplierId: supplier1,
      productId: product1,
      quantity: 200,
      orderDate: now - 10 * dayMs,
      expectedDeliveryDate: now + 4 * dayMs,
      status: "in_transit",
      trackingNumber: "TRK123456789",
    });

    await ctx.db.insert("shipments", {
      supplierId: supplier3,
      productId: product3,
      quantity: 100,
      orderDate: now - 15 * dayMs,
      expectedDeliveryDate: now - 2 * dayMs,
      status: "delayed",
      delayReason: "Customs clearance issues",
    });

    // Create sample alerts
    await ctx.db.insert("alerts", {
      type: "low_stock",
      title: "Low Stock Alert",
      description: "Wireless Headphones stock is below reorder point",
      severity: "high",
      productId: product1,
      isResolved: false,
      createdAt: now,
    });

    await ctx.db.insert("alerts", {
      type: "supplier_delay",
      title: "Supplier Delay",
      description: "EuroTech Solutions shipment delayed due to customs",
      severity: "medium",
      supplierId: supplier3,
      isResolved: false,
      createdAt: now,
    });

    return { message: "Sample data initialized successfully" };
  },
});
