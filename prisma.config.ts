import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma CLI configuration (migrations, seed). Runtime queries use the
// driver adapter in src/infrastructure/prisma/prisma.service.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
