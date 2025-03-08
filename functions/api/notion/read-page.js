/**
 * Notion Page Read API Proxy
 * This serverless function reads the content of a Notion page
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

    // Get page ID from the URL or query params
    const url = new URL(context.request.url);
    const pageId = url.searchParams.get('page_id');
    
    if (!pageId) {
      return new Response(JSON.stringify({ error: 'Page ID is required' }), {
        status: 400,
        headers
      });
    }

    console.log(`Reading Notion page content: ${pageId}`);

    // First, get the page blocks
    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Notion-Version': '2022-06-28'
      }
    });

    // Get response as JSON
    const data = await response.json();

    // If Notion API returns an error
    if (!response.ok) {
      console.error('Notion API error:', data);
      return new Response(JSON.stringify({ 
        error: 'Failed to read Notion page',
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    // Extract the text content from blocks
    let pageContent = '';
    if (data.results && data.results.length > 0) {
      pageContent = data.results.map(block => {
        if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
          return block.paragraph.rich_text.map(text => text.plain_text).join('');
        }
        return '';
      }).filter(text => text).join('\n');
    }

    console.log(`Successfully read page with ${data.results ? data.results.length : 0} blocks`);

    // Return the page content
    return new Response(JSON.stringify({
      success: true,
      pageId,
      blocks: data.results || [],
      content: pageContent
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