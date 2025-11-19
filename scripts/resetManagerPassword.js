// Reset manager password to a known value
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetPassword() {
  try {
    console.log('🔧 Resetting manager password...\n');

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Manager = mongoose.model('Manager', new mongoose.Schema({}, { strict: false, collection: 'managers' }));

    // New password
    const newPassword = '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the manager
    const result = await Manager.updateOne(
      { email: 'test@gmail.com' },
      {
        $set: {
          password: hashedPassword,
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
      console.log('✅ Password reset successfully!');
      console.log('   Email: test@gmail.com');
      console.log('   New Password: 123456');
      console.log('   - emailVerified: true');
      console.log('   - isActive: true');
      console.log('   - loginAttempts: 0');
      console.log('\n✅ You can now login with:');
      console.log('   Email: test@gmail.com');
      console.log('   Password: 123456\n');
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

resetPassword();
