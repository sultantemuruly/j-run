import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use pooled connection for runtime queries (better for serverless)
const queryClient = postgres(process.env.DATABASE_URL!);

export const db = drizzle(queryClient, { schema });

