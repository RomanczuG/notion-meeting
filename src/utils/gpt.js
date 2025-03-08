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
        
        // Preparing a prompt that asks GPT to enhance the entire document
        const prompt = `
You are an AI assistant helping to create better meeting notes in real-time.

CURRENT TRANSCRIPT:
${currentContent || "The meeting just started."}

NEW TRANSCRIPT SEGMENTS TO ADD:
${formattedNewTranscripts}

Using all the information, please create a complete, well-formatted set of meeting notes.
Please:
1. Structure the meeting notes with headers, bullet points, and organized sections
2. Highlight key decisions, action items and important points
3. Make it easy to read and well-organized
4. Keep the chronological flow of the meeting
5. Include all important content from both current and new transcript sections
6. Format for Notion using Markdown

Your response should ONLY contain the enhanced meeting notes (no explanations). 
This will directly replace the entire page content in Notion.
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