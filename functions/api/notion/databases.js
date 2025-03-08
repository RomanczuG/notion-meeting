/**
 * Notion Databases API Proxy
 * This serverless function proxies requests to the Notion API for database operations
 */

export async function onRequest(context) {
  // CORS headers to allow requests from your frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Only allow GET requests
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    // Get the access token from the request
    const authorization = context.request.headers.get('Authorization');
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'No authorization token provided' }), {
        status: 401,
        headers
      });
    }

    console.log('Fetching Notion databases...');

    // Prepare request payload
    const payload = {
      filter: {
        value: 'database',
        property: 'object'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    };

    // Call Notion API to get databases
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(payload)
    });

    // Get response as JSON
    const data = await response.json();

    // If Notion API returns an error
    if (!response.ok) {
      console.error('Notion API error:', data);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch databases from Notion',
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    console.log(`Successfully retrieved ${data.results?.length || 0} Notion databases`);

    // Return the databases to the client
    return new Response(JSON.stringify(data), { headers });
  } catch (error) {
    console.error('Server error:', error);
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      message: error.message 
    }), {
      status: 500,
      headers
    });
  }
} 