// Quick script to verify the test manager
const mongoose = require('mongoose');
require('dotenv').config();

async function verifyManager() {
  try {
    console.log('🔧 Verifying manager...\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Manager = mongoose.model('Manager', new mongoose.Schema({}, { strict: false, collection: 'managers' }));

    // Update the test@gmail.com manager
    const result = await Manager.updateOne(
      { email: 'test@gmail.com' },
      {
        $set: {
          emailVerified: true,
          isActive: true,
          loginAttempts: 0
        },
        $unset: {
          lockUntil: "",
          emailVerificationToken: "",
          emailVerificationExpires: ""
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Manager updated successfully!');
      console.log('   - emailVerified: true');
      console.log('   - isActive: true');
      console.log('   - loginAttempts: 0');
      console.log('   - Removed verification tokens');
      console.log('\n✅ Manager test@gmail.com can now login!\n');
    } else {
      console.log('⚠️  No manager found with email test@gmail.com');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

verifyManager();
