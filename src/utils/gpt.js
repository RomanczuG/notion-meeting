/**
 * GPT-4o-mini integration for enhancing meeting transcripts
 */

/**
 * Enhance the entire transcript using GPT-4o-mini
 * @param {string} currentContent - The current page content
 * @param {Array} newTranscripts - Array of new transcript segments with { text, speaker } format
 * @returns {Promise<{success: boolean, enhanced: string}>} - The enhanced content
 */
export async function enhanceWholeTranscript(currentContent, newTranscripts) {
    try {
        console.log(`Sending ${newTranscripts.length} transcript segments to GPT-4o-mini for enhancement`);
        
        // Format the new transcripts as a single string
        const formattedNewTranscripts = newTranscripts.map(segment => {
            return segment.speaker 
                ? `[Speaker ${segment.speaker}] ${segment.text.trim()}`
                : segment.text.trim();
        }).join('\n');
        
        // Preparing a prompt that asks GPT to enhance just the new content
        const prompt = `
You are an AI assistant helping to create better meeting notes in real-time.

The meeting is ongoing. Below, you'll see:
1. Some context from earlier in the meeting (CONTEXT section)
2. The latest batch of transcriptions that need to be processed (NEW TRANSCRIPT SEGMENTS)

CONTEXT (earlier parts of the meeting - for reference only):
${currentContent || "The meeting just started."}

NEW TRANSCRIPT SEGMENTS:
${formattedNewTranscripts}

Your task is to create a well-formatted CONTEXT that includes the entire meeting with new segments.
Please:
1. Structure this segment with headers, bullet points, and organized sections
2. Highlight key decisions, action items and important points
3. Make it easy to read and well-organized
4. Keep the chronological flow
5. Format for Notion using Markdown

Your response should contain the enhanced notes for the CONTEXT and NEW SEGMENTS (no explanations).
`;

        const response = await fetch('/api/gpt/enhance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                currentContent,
                newTranscript: formattedNewTranscripts,
                fullPrompt: prompt
            }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Error enhancing transcript with GPT:', data);
            throw new Error(`Failed to enhance transcript: ${response.statusText}`);
        }

        console.log('Successfully enhanced transcript with GPT-4o-mini');
        return data;
    } catch (error) {
        console.error('Error in enhanceWholeTranscript:', error);
        // Return the original transcripts if enhancement fails
        return {
            success: false,
            original: newTranscripts.map(t => t.text).join('\n'),
            enhanced: newTranscripts.map(seg => 
                seg.speaker ? `[Speaker ${seg.speaker}] ${seg.text.trim()}` : seg.text.trim()
            ).join('\n'),
            error: error.message
        };
    }
}

// Keep the original function for backward compatibility
export async function enhanceTranscript(currentContent, newTranscript, speaker = null) {
    try {
        console.log('Sending transcript to GPT-4o-mini for enhancement');
        
        const response = await fetch('/api/gpt/enhance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                currentContent,
                newTranscript,
                speaker
            }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Error enhancing transcript with GPT:', data);
            throw new Error(`Failed to enhance transcript: ${response.statusText}`);
        }

        console.log('Successfully enhanced transcript with GPT-4o-mini');
        return data;
    } catch (error) {
        console.error('Error in enhanceTranscript:', error);
        // Return the original transcript if enhancement fails
        return {
            success: false,
            original: newTranscript,
            enhanced: speaker ? `[${speaker}] ${newTranscript}` : newTranscript,
            error: error.message
        };
    }
} 