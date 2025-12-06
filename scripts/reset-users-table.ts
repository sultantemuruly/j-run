/**
 * Script to reset the users table for migration from integer ID to UUID
 * Run this with: npx tsx scripts/reset-users-table.ts
 */

import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DIRECT_URL!);

async function resetUsersTable() {
  try {
    console.log('Dropping existing users table...');
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    console.log('✅ Users table dropped successfully');
    console.log('\nNow run: npx drizzle-kit push');
  } catch (error) {
    console.error('❌ Error resetting users table:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetUsersTable();

