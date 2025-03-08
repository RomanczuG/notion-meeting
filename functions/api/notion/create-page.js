/**
 * Notion Page Creation API Proxy
 * This serverless function proxies requests to the Notion API for page creation
 */

export async function onRequest(context) {
  // CORS headers to allow requests from your frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Only allow POST requests
  if (context.request.method !== 'POST') {
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

    // Get request body
    const requestBody = await context.request.json();
    const { databaseId, title } = requestBody;

    if (!databaseId || !title) {
      return new Response(JSON.stringify({ error: 'Database ID and title are required' }), {
        status: 400,
        headers
      });
    }

    // Call Notion API to create a page
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          }
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: []
            }
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
        error: 'Failed to create page in Notion',
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    // Return the created page to the client
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