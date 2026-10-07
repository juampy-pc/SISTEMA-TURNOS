#!/usr/bin/env bash
set -euo pipefail
eval "$(npx supabase status -o env)"
cat > .env.local <<EOT
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOT
