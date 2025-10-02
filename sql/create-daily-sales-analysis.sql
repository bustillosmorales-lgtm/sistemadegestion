-- Create daily_sales_analysis table
-- Run this in Supabase SQL Editor

-- Drop table if it exists to recreate it properly
DROP TABLE IF EXISTS public.daily_sales_analysis;

-- Create the table with proper structure
CREATE TABLE public.daily_sales_analysis (
    sku VARCHAR(255) PRIMARY KEY,
    venta_diaria DECIMAL(10,4) NOT NULL DEFAULT 0,
    fecha_calculo DATE NOT NULL DEFAULT CURRENT_DATE,
    dias_historicos INTEGER DEFAULT 0,
    metodo_calculo VARCHAR(50) DEFAULT 'real_data',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_daily_sales_analysis_fecha_calculo ON public.daily_sales_analysis(fecha_calculo);
CREATE INDEX idx_daily_sales_analysis_venta_diaria ON public.daily_sales_analysis(venta_diaria);

-- Enable Row Level Security
ALTER TABLE public.daily_sales_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on daily_sales_analysis" ON public.daily_sales_analysis
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.daily_sales_analysis TO authenticated;
GRANT ALL ON public.daily_sales_analysis TO anon;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';