# Daily Sales Analysis Setup

## Problem Identified

The `daily_sales_analysis` table exists in the database but is not properly recognized by Supabase's schema cache, causing "Could not find the table in the schema cache" errors when trying to insert/upsert data.

## Solution

### Step 1: Create Table Properly in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run the SQL script located at: `sql/create-daily-sales-analysis.sql`

This script will:
- Drop and recreate the table properly
- Add necessary indexes
- Set up Row Level Security
- Grant proper permissions
- Refresh the schema cache

### Step 2: Populate the Table

After creating the table properly, you can use either of these scripts:

#### Option A: Simple Population Script (Recommended for Testing)
```bash
node scripts/populate-daily-sales-insert.js
```
- Processes 50 products (limited for testing)
- Uses direct INSERT statements
- Includes debug output for specific SKUs

#### Option B: Full Population Script
```bash
node scripts/populate-daily-sales.js
```
- Processes all 1000+ products
- Uses upsert operations (requires proper schema cache)
- Includes comprehensive statistics

#### Option C: Analysis.js Integration
```bash
node scripts/calculate-daily-sales.js
```
- Uses the exact same logic as analysis.js
- Calls `calculateVentaDiariaBatch` function
- Best for production use

## Files Created/Modified

1. **`sql/create-daily-sales-analysis.sql`** - SQL script for proper table creation
2. **`scripts/populate-daily-sales-insert.js`** - Alternative population script using INSERT
3. **`scripts/populate-daily-sales.js`** - Original population script (already existed)
4. **`scripts/calculate-daily-sales.js`** - Analysis.js integration script (already existed)
5. **`scripts/create-table-only.js`** - Table verification script (already existed)

## Table Structure

```sql
CREATE TABLE public.daily_sales_analysis (
    sku VARCHAR(255) PRIMARY KEY,
    venta_diaria DECIMAL(10,4) NOT NULL DEFAULT 0,
    fecha_calculo DATE NOT NULL DEFAULT CURRENT_DATE,
    dias_historicos INTEGER DEFAULT 0,
    metodo_calculo VARCHAR(50) DEFAULT 'real_data',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Next Steps

1. **IMPORTANT**: Run the SQL script in Supabase SQL Editor first
2. Test with the INSERT-based script to verify the table works
3. Once confirmed, run the full population script
4. Set up a cron job or scheduled task to run the calculation nightly

## Debug Information

- Test SKU `649762430948` is specifically tracked in all scripts for debugging
- The calculation uses real purchase and sales data with 30-day minimum periods
- Products without stock use their last stockout date as the end period

## Verification Commands

```bash
# Check if table exists and is accessible
node scripts/create-table-only.js

# Test population with small dataset
node scripts/populate-daily-sales-insert.js

# Check specific SKU calculation
# (Look for DEBUG output in the console)
```