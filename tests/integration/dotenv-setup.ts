import { resolve } from "node:path";

import dotenv from "dotenv";

// Load before any `@/utils/supabase/admin` imports (happens via setupFiles order).
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });
