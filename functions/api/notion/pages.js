/**
 * Notion Pages API Proxy
 * This serverless function proxies requests to the Notion API for page operations
 */

export async function onRequest(context) {
  // CORS headers to allow requests from your frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
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

    // Get database ID from the URL or query params
    const url = new URL(context.request.url);
    const databaseId = url.searchParams.get('database_id');
    
    if (!databaseId) {
      return new Response(JSON.stringify({ error: 'Database ID is required' }), {
        status: 400,
        headers
      });
    }

    console.log(`Fetching pages for database: ${databaseId}`);

    // Call Notion API to get database pages
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        page_size: 100,
        sorts: [
          {
            property: 'last_edited_time',
            direction: 'descending'
          }
        ]
      })
    });

    // Get response as JSON
    const data = await response.json();

    // If Notion API returns an error
    if (!response.ok) {
      console.error('Notion API error:', data);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch pages from Notion',
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    // Return the pages to the client
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