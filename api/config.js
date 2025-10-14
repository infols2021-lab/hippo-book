// api/config.js - Serverless Function для Vercel
module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const config = {
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://zjvedphdbpuzqzvznqex.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdmVkcGhkYnB1enF6dnpucWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDMxMDgsImV4cCI6MjA3NTkxOTEwOH0.rfIdcmTx9q-UZyQp0QKjBdGQGbDpMuy0R3_3P_DOV7I'
    };
    
    const jsCode = `
        window.SUPABASE_URL = '${config.SUPABASE_URL}';
        window.SUPABASE_ANON_KEY = '${config.SUPABASE_ANON_KEY}';
        console.log('✅ Config loaded from API:', window.SUPABASE_URL ? 'Success' : 'Failed');
    `;
    
    res.status(200).send(jsCode);
};