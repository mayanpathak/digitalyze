import fetch from 'node-fetch';

const BACKEND_URL = 'https://digitalyze-rb7o.onrender.com';
const FRONTEND_URL = 'https://digitalyze-one.vercel.app';

async function testCORS() {
  console.log('🧪 Testing CORS configuration...\n');
  
  const endpoints = [
    '/api/health',
    '/api/data/clients/stats',
    '/api/data/workers/stats', 
    '/api/data/tasks/stats',
    '/api/ai/rule-recommendations',
    '/api/data/validation-summary'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${BACKEND_URL}${endpoint}`);
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Origin': FRONTEND_URL,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ CORS Headers: ${response.headers.get('access-control-allow-origin') || 'None'}`);
      
      if (response.ok) {
        const data = await response.text();
        console.log(`✅ Response: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('---');
  }
}

testCORS(); 