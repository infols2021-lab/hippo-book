// api/config.js - Serverless Function для Vercel
module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const config = {
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://dtjhlanmwjpdcdxgzzyo.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0amhsYW5td2pwZGNkeGd6enlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDUwOTIsImV4cCI6MjA3MjM4MTA5Mn0.jS4DXQSOBawRFtnzjsmF5AzzltDYAG0AXrwrY1B0UpY'
    };
    
    const jsCode = `
        window.SUPABASE_URL = '${config.SUPABASE_URL}';
        window.SUPABASE_ANON_KEY = '${config.SUPABASE_ANON_KEY}';
        console.log('✅ Config loaded from API:', window.SUPABASE_URL ? 'Success' : 'Failed');
    `;
    
    res.status(200).send(jsCode);
};