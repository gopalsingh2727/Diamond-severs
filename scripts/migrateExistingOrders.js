/**
 * Migration Script: Assign Default Order Type to Existing Orders
 *
 * This script assigns the "Standard Manufacturing" order type to all existing orders
 * that don't have an orderTypeId. This ensures backward compatibility after
 * introducing the Order Type system.
 *
 * Usage:
 *   node scripts/migrateExistingOrders.js
 *   node scripts/migrateExistingOrders.js --dry-run  (to preview changes without applying)
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Order = require('../models/oders/oders');
const OrderType = require('../models/OrderType/orderType');

// MongoDB connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://27shopgopal:S3kYB9MgKHPpaBjJ@cluster0.uvelucm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Analyze existing orders to understand what needs migration
 */
const analyzeOrders = async () => {
  console.log('🔍 Analyzing existing orders...\n');

  const totalOrders = await Order.countDocuments({});
  const ordersWithType = await Order.countDocuments({ orderTypeId: { $exists: true, $ne: null } });
  const ordersWithoutType = await Order.countDocuments({
    $or: [
      { orderTypeId: { $exists: false } },
      { orderTypeId: null }
    ]
  });

  console.log('📊 Order Analysis:');
  console.log(`   Total orders: ${totalOrders}`);
  console.log(`   Orders with order type: ${ordersWithType}`);
  console.log(`   Orders without order type: ${ordersWithoutType}`);

  // Analyze order characteristics to suggest order types
  const printingOrders = await Order.countDocuments({
    $or: [
      { orderTypeId: { $exists: false } },
      { orderTypeId: null }
    ],
    Printing: true
  });

  const sameDayOrders = await Order.countDocuments({
    $or: [
      { orderTypeId: { $exists: false } },
      { orderTypeId: null }
    ],
    sameDayDispatch: true
  });

  const urgentOrders = await Order.countDocuments({
    $or: [
      { orderTypeId: { $exists: false } },
      { orderTypeId: null }
    ],
    priority: 'urgent'
  });

  console.log('\n📋 Order Characteristics:');
  console.log(`   Orders with Printing: ${printingOrders}`);
  console.log(`   Orders with same-day dispatch: ${sameDayOrders}`);
  console.log(`   Orders with urgent priority: ${urgentOrders}`);

  // Get branch distribution
  const branchDistribution = await Order.aggregate([
    {
      $match: {
        $or: [
          { orderTypeId: { $exists: false } },
          { orderTypeId: null }
        ]
      }
    },
    {
      $group: {
        _id: '$branchId',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'branches',
        localField: '_id',
        foreignField: '_id',
        as: 'branch'
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  if (branchDistribution.length > 0) {
    console.log('\n🏢 Orders by Branch (without type):');
    branchDistribution.forEach(item => {
      const branchName = item.branch[0]?.name || 'Unknown';
      const branchCode = item.branch[0]?.code || 'N/A';
      console.log(`   ${branchName} (${branchCode}): ${item.count} orders`);
    });
  }

  return {
    totalOrders,
    ordersWithType,
    ordersWithoutType,
    printingOrders,
    sameDayOrders,
    urgentOrders
  };
};

/**
 * Migrate orders to appropriate order types
 */
const migrateOrders = async (dryRun = false) => {
  console.log('\n🔄 Starting migration...\n');

  // Get the Standard Manufacturing order type
  const standardType = await OrderType.findOne({
    typeCode: 'STD',
    isGlobal: true
  });

  if (!standardType) {
    throw new Error('Standard Manufacturing order type not found. Please run seedDefaultOrderTypes.js first.');
  }

  console.log(`✅ Found Standard Manufacturing order type (ID: ${standardType._id})`);

  // Get the Printing order type
  const printingType = await OrderType.findOne({
    typeCode: 'PRNT',
    isGlobal: true
  });

  // Get the Express order type
  const expressType = await OrderType.findOne({
    typeCode: 'EXP',
    isGlobal: true
  });

  const migrationSummary = {
    standard: 0,
    printing: 0,
    express: 0,
    failed: 0
  };

  // Find all orders without an order type
  const ordersToMigrate = await Order.find({
    $or: [
      { orderTypeId: { $exists: false } },
      { orderTypeId: null }
    ]
  }).sort({ createdAt: 1 });

  console.log(`\n📦 Found ${ordersToMigrate.length} orders to migrate`);

  if (ordersToMigrate.length === 0) {
    console.log('✅ No orders need migration!');
    return migrationSummary;
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Migrate each order
  for (const order of ordersToMigrate) {
    try {
      let targetType = standardType;
      let reason = 'Default';

      // Smart assignment based on order characteristics
      if (order.Printing && printingType) {
        targetType = printingType;
        reason = 'Has printing enabled';
        migrationSummary.printing++;
      } else if ((order.sameDayDispatch || order.priority === 'urgent') && expressType) {
        targetType = expressType;
        reason = 'Same-day/Urgent order';
        migrationSummary.express++;
      } else {
        migrationSummary.standard++;
      }

      const branchInfo = order.branchId ? ` [Branch: ${order.branchId}]` : '';
      console.log(`   ${order.orderId}${branchInfo} → ${targetType.typeName} (${reason})`);

      if (!dryRun) {
        order.orderTypeId = targetType._id;
        await order.save();
      }

    } catch (error) {
      console.error(`   ❌ Failed to migrate order ${order.orderId}:`, error.message);
      migrationSummary.failed++;
    }
  }

  return migrationSummary;
};

/**
 * Verify migration results
 */
const verifyMigration = async () => {
  console.log('\n✅ Verifying migration...\n');

  const ordersWithoutType = await Order.countDocuments({
    $or: [
      { orderTypeId: { $exists: false } },
      { orderTypeId: null }
    ]
  });

  if (ordersWithoutType === 0) {
    console.log('✅ All orders have been assigned an order type!');
  } else {
    console.log(`⚠️  Warning: ${ordersWithoutType} orders still don't have an order type`);
  }

  // Get distribution by order type
  const typeDistribution = await Order.aggregate([
    {
      $match: {
        orderTypeId: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$orderTypeId',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'ordertypes',
        localField: '_id',
        foreignField: '_id',
        as: 'orderType'
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  console.log('\n📊 Orders by Type:');
  typeDistribution.forEach(item => {
    const typeName = item.orderType[0]?.typeName || 'Unknown';
    const typeCode = item.orderType[0]?.typeCode || 'N/A';
    console.log(`   ${typeName} (${typeCode}): ${item.count} orders`);
  });
};

/**
 * Main migration function
 */
const main = async () => {
  const isDryRun = process.argv.includes('--dry-run');

  try {
    await connectToDatabase();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Order Type Migration Script');
    console.log('═══════════════════════════════════════════════════════\n');

    // Step 1: Analyze
    const analysis = await analyzeOrders();

    if (analysis.ordersWithoutType === 0) {
      console.log('\n✅ All orders already have order types assigned!');
      console.log('No migration needed.\n');
      return;
    }

    // Step 2: Confirm
    if (!isDryRun) {
      console.log('\n⚠️  IMPORTANT: This will modify existing orders in the database.');
      console.log('Make sure you have a backup before proceeding.\n');
      console.log('To preview changes without applying them, run:');
      console.log('  node scripts/migrateExistingOrders.js --dry-run\n');

      // In a real scenario, you might want to add interactive confirmation
      // For now, we'll just show a warning
      console.log('Proceeding with migration in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Step 3: Migrate
    const summary = await migrateOrders(isDryRun);

    // Step 4: Display summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Migration Summary');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`   Standard Manufacturing: ${summary.standard} orders`);
    console.log(`   Printing Orders: ${summary.printing} orders`);
    console.log(`   Express Orders: ${summary.express} orders`);
    console.log(`   Failed: ${summary.failed} orders`);
    console.log(`   Total Migrated: ${summary.standard + summary.printing + summary.express}\n`);

    if (isDryRun) {
      console.log('ℹ️  This was a DRY RUN - no changes were made to the database.');
      console.log('To apply these changes, run without --dry-run flag.\n');
    } else {
      // Step 5: Verify
      await verifyMigration();
      console.log('\n✅ Migration completed successfully!\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { analyzeOrders, migrateOrders, verifyMigration };
