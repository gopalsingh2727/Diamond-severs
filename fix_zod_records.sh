#!/bin/bash

echo "🔧 Fixing machineStep.handler.ts syntax error..."

# Uncomment the lines first
sed -i '' '227,237s/^    \/\/ //' src/handlers/order/machineStep.handler.ts

# Now properly delete just the problematic lines
sed -i '' '227,237d' src/handlers/order/machineStep.handler.ts

echo "✅ Fixed!"
echo "▶️  Run: npm run build"