# Logistics Assistant Dashboard

A comprehensive supply chain management dashboard built with React, TypeScript, and Convex. Track suppliers, inventory, shipments, and get real-time insights into your logistics operations.

## Features

- **Dashboard Overview**: Real-time metrics and visualizations
- **Smart Query System**: Natural language queries about your supply chain
- **Inventory Management**: Track stock levels and reorder points
- **Shipment Tracking**: Monitor deliveries and delays
- **Supplier Management**: Evaluate supplier performance
- **Alert System**: Automated notifications for critical issues

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your Convex project:
```bash
npx convex dev
```

3. Run the development server:
```bash
npm run dev
```

## Usage

1. **Initialize Sample Data**: The app will automatically load sample supply chain data on first visit
2. **Explore Dashboard**: View key metrics and charts
3. **Ask Questions**: Use natural language to query your supply chain data
4. **Monitor Operations**: Check inventory, shipments, suppliers, and alerts

## Sample Questions

- "Which supplier is causing delays?"
- "What should I reorder this week?"
- "Which suppliers have the lowest reliability?"
- "What products will be out of stock next week?"
- "Show me all delayed shipments"
- "What are the current inventory levels?"

## Database Schema

The application uses Convex for data storage with the following tables:
- Suppliers
- Products
- Inventory
- Shipments
- Alerts
- Query History

## Features

### Dashboard
- Key performance indicators
- Inventory level charts
- Shipment status distribution
- Real-time alerts

### Smart Query System
- Natural language processing
- Contextual analysis
- Actionable recommendations
- Query history

### Inventory Management
- Stock level monitoring
- Reorder point alerts
- Warehouse filtering
- Low stock notifications

### Shipment Tracking
- Status monitoring
- Delay tracking
- Supplier performance
- Delivery predictions

### Supplier Management
- Reliability scoring
- Performance metrics
- Contact management
- Status tracking

### Alert System
- Automated notifications
- Severity levels
- Issue categorization
- Resolution tracking
