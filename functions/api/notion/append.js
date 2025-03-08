/**
 * Notion Content Append API Proxy
 * This serverless function proxies requests to the Notion API for appending content to pages
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
    const { pageId, content, speaker } = requestBody;

    if (!pageId || !content) {
      return new Response(JSON.stringify({ error: 'Page ID and content are required' }), {
        status: 400,
        headers
      });
    }

    console.log(`Appending to page ${pageId}: ${content} (Speaker: ${speaker || 'None'})`);

    // Prepare request payload
    const payload = {
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: speaker ? `[${speaker}] ${content}` : content
                },
                annotations: speaker ? {
                  bold: true,
                  color: 'blue'
                } : undefined
              }
            ]
          }
        }
      ]
    };

    console.log('Request payload:', JSON.stringify(payload));

    // Call Notion API to append to a page
    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(payload)
    });

    // Get response as text first for debugging
    const responseText = await response.text();
    console.log('Notion API response:', responseText);
    
    // Try to parse the response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseText);
      data = { error: 'Invalid JSON response', raw: responseText };
    }

    // If Notion API returns an error
    if (!response.ok) {
      console.error(`Notion API error (${response.status}):`, data);
      return new Response(JSON.stringify({ 
        error: 'Failed to append to page in Notion',
        status: response.status,
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    console.log('Successfully appended to Notion page');

    // Return success message to the client
    return new Response(JSON.stringify({
      success: true,
      message: 'Content successfully appended to page',
      data
    }), { headers });
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