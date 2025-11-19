// ============================================================================
// FIX MANAGER EMAIL VERIFICATION - Mark all existing managers as verified
// ============================================================================
// Run this script once to fix existing managers in database
// Usage: node scripts/fixManagerEmailVerification.js

const mongoose = require('mongoose');
require('dotenv').config();

async function fixManagerEmailVerification() {
  try {
    console.log('🔧 Starting Manager Email Verification Fix...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get Manager model
    const Manager = mongoose.model('Manager');

    // Find all managers
    const allManagers = await Manager.find({});
    console.log(`📊 Found ${allManagers.length} total managers\n`);

    // Find unverified managers
    const unverifiedManagers = await Manager.find({
      $or: [
        { isEmailVerified: false },
        { isEmailVerified: { $exists: false } }
      ]
    });

    console.log(`⚠️  Found ${unverifiedManagers.length} managers with unverified emails:\n`);

    if (unverifiedManagers.length === 0) {
      console.log('✅ All managers are already verified!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Display managers to be updated
    unverifiedManagers.forEach((manager, index) => {
      console.log(`   ${index + 1}. ${manager.email} (${manager.username})`);
    });

    console.log('\n🔄 Updating managers...\n');

    // Update all unverified managers
    const result = await Manager.updateMany(
      {
        $or: [
          { isEmailVerified: false },
          { isEmailVerified: { $exists: false } }
        ]
      },
      {
        $set: {
          isEmailVerified: true,
          loginAttempts: 0,
          isActive: true
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationExpires: "",
          lockUntil: ""
        }
      }
    );

    console.log(`✅ Successfully updated ${result.modifiedCount} managers:\n`);
    console.log('   ✓ Set isEmailVerified: true');
    console.log('   ✓ Reset loginAttempts: 0');
    console.log('   ✓ Set isActive: true');
    console.log('   ✓ Removed verification tokens');
    console.log('   ✓ Unlocked accounts\n');

    // Verify the update
    const stillUnverified = await Manager.find({ isEmailVerified: false });
    if (stillUnverified.length === 0) {
      console.log('✅ Verification complete! All managers can now login.\n');
    } else {
      console.log(`⚠️  Warning: ${stillUnverified.length} managers still unverified\n`);
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the fix
fixManagerEmailVerification();
