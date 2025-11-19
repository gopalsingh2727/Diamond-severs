#!/bin/bash

# ============================================
# Prisma Migration Setup Script
# ============================================

echo "🚀 Starting Prisma Migration Setup..."

# Step 1: Backup existing files
echo "📦 Step 1: Creating backup..."
mkdir -p backup
cp -r models backup/models_backup_$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created in backup/ directory"

# Step 2: Copy complete schema
echo "📄 Step 2: Setting up Prisma schema..."
cp prisma/schema.complete.prisma prisma/schema.prisma
echo "✅ Prisma schema is ready"

# Step 3: Install dependencies
echo "📦 Step 3: Installing dependencies..."
npm install @prisma/client bcryptjs jsonwebtoken uuid zod --save
npm install prisma typescript ts-node @types/node @types/bcryptjs @types/jsonwebtoken @types/uuid --save-dev
echo "✅ Dependencies installed"

# Step 4: Generate Prisma Client
echo "🔧 Step 4: Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"

# Step 5: Create .env if not exists
if [ ! -f .env ]; then
  echo "⚙️ Step 5: Creating .env file..."
  cp .env.example .env
  echo "⚠️ IMPORTANT: Please update .env with your DATABASE_URL and JWT_SECRET"
else
  echo "✅ .env file already exists"
fi

# Step 6: Generate UUID for software license
echo "🔑 Step 6: Generating software license key..."
LICENSE_KEY=$(node -e "console.log(require('crypto').randomUUID().replace(/-/g, ''))")
echo "Your Product27InfinityId: $LICENSE_KEY"
echo "Add this to your .env file: DEFAULT_PRODUCT27_INFINITY_ID=\"$LICENSE_KEY\""

# Step 7: Create seed file
echo "🌱 Step 7: Creating seed file..."
cat > prisma/seed.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const licenseKey = process.env.DEFAULT_PRODUCT27_INFINITY_ID || 'REPLACE_WITH_GENERATED_KEY';
  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@main27.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@main27.com',
      password: hashedPassword,
      product27InfinityId: licenseKey,
      isActive: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'Main Branch',
      code: 'MAIN',
      location: 'Head Office',
      adminId: admin.id,
      product27InfinityId: licenseKey,
      isActive: true,
    },
  });

  console.log('✅ Seed data created');
  console.log('📧 Admin Email:', admin.email);
  console.log('🔑 Password: Admin123!');
  console.log('🏢 Branch:', branch.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

echo "✅ Seed file created"

# Step 8: Instructions
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Update .env with your MongoDB connection string"
echo "2. Add the generated license key to .env"
echo "3. Run: npx prisma db push (to sync schema with database)"
echo "4. Run: npx ts-node prisma/seed.ts (to create admin account)"
echo "5. Test login: POST /admin/login with email: admin@main27.com, password: Admin123!"
echo ""
echo "📚 Documentation:"
echo "- PRISMA_MIGRATION_GUIDE.md - Complete migration guide"
echo "- CACHED_DATA_AVAILABLE.md - Frontend optimization guide"
echo "- OPTIMIZATION_PROGRESS.md - Current progress"
echo ""
echo "🎉 Ready to start using Prisma!"
