/**
 * Test function para debugging
 */

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Test 1: Environment variables
    const envTest = {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      nodeVersion: process.version
    };

    // Test 2: Require xlsx
    let xlsxTest = 'not loaded';
    try {
      const XLSX = require('xlsx');
      xlsxTest = 'loaded successfully';
    } catch (e) {
      xlsxTest = `error: ${e.message}`;
    }

    // Test 3: Require supabase
    let supabaseTest = 'not loaded';
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabaseTest = 'loaded successfully';
    } catch (e) {
      supabaseTest = `error: ${e.message}`;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tests: {
          environment: envTest,
          xlsx: xlsxTest,
          supabase: supabaseTest
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};
