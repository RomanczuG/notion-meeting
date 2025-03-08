/**
 * GPT-4o-mini API Integration
 * This serverless function sends content to GPT-4o-mini for enhancement
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
    // Get API key from environment
    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers
      });
    }

    // Get request body
    const { currentContent, newTranscript, speaker, fullPrompt } = await context.request.json();

    if (!newTranscript && !fullPrompt) {
      return new Response(JSON.stringify({ error: 'New transcript or full prompt is required' }), {
        status: 400,
        headers
      });
    }

    console.log('Sending to GPT-4o-mini for enhancement');

    // Prepare the prompt - use provided fullPrompt if available, otherwise use default
    const prompt = fullPrompt || `
You are an AI assistant helping to create better meeting notes in real-time.

CURRENT TRANSCRIPT:
${currentContent || "The meeting just started."}

NEW TRANSCRIPT SEGMENT:
${speaker ? `[${speaker}] ${newTranscript}` : newTranscript}

Please enhance this transcript by:
1. Formatting it in a clean way for Notion
2. Adding appropriate headers, bullet points, and structure
3. Highlighting key points or actions
4. Maintaining the core content and context

Your response should be in Markdown format that works well in Notion, and should ONLY include the enhanced text (no explanations).
`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that formats meeting transcripts for Notion.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return new Response(JSON.stringify({ 
        error: 'Failed to enhance content with GPT-4o-mini',
        details: data
      }), {
        status: response.status,
        headers
      });
    }

    // Extract the enhanced content from GPT response
    const enhancedContent = data.choices[0].message.content;

    console.log('Successfully enhanced content with GPT-4o-mini');

    // Return the enhanced content
    return new Response(JSON.stringify({
      success: true,
      original: newTranscript,
      enhanced: enhancedContent
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