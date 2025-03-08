/**
 * Notion OAuth Token Exchange Handler
 * This serverless function exchanges the authorization code for an access token
 */

export async function onRequest(context) {
  // CORS headers to allow requests from your frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    // Get request body
    const body = await context.request.json();
    const { code, redirectUri } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: 'Authorization code is required' }), {
        status: 400,
        headers
      });
    }

    // Your Notion client secret should be stored as an environment variable
    // in Cloudflare Pages dashboard
    const clientId = context.env.NOTION_CLIENT_ID;
    const clientSecret = context.env.NOTION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ 
        error: 'Missing Notion credentials in server configuration'
      }), {
        status: 500,
        headers
      });
    }

    // Call Notion API to exchange code for token
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    // Get response as JSON
    const data = await response.json();

    // If Notion API returns an error
    if (!response.ok) {
      console.error('Notion API error:', data);
      return new Response(JSON.stringify({ 
        error: 'Failed to exchange code for token',
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    // Return the access token and other data to the client
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