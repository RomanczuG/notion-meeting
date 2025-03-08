import { useEffect, useState, useRef, useCallback } from 'react';

import Progress from './components/Progress';
import MediaInput from './components/MediaInput';
import MicrophoneInput from './components/MicrophoneInput';
import Transcript from './components/Transcript';
import LanguageSelector from './components/LanguageSelector';
import NotionClient, { getNotionAccessToken, simulateNotionToken } from './utils/notion';
import NotionAuth from './components/NotionAuth';
import NotionPageSelector from './components/NotionPageSelector';
import { enhanceTranscript, enhanceWholeTranscript } from './utils/gpt';

// 1a3316d6a1f2807ebf1be5dcf6cd849a databse_id
// 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 api_key

async function hasWebGPU() {
    if (!navigator.gpu) {
        return false;
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch (e) {
        return false;
    }
}

function App() {

    // Create a reference to the worker object.
    const worker = useRef(null);

    // Model loading and progress
    const [status, setStatus] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [progressItems, setProgressItems] = useState([]);

    const mediaInputRef = useRef(null);
    const [audio, setAudio] = useState(null);
    const [language, setLanguage] = useState('en');
    const [isRecording, setIsRecording] = useState(false);
    const [isRealtime, setIsRealtime] = useState(false);

    const [result, setResult] = useState(null);
    const [time, setTime] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [realtimeTranscript, setRealtimeTranscript] = useState({ transcript: '', segments: [] });

    const [device, setDevice] = useState('webgpu'); // Try use WebGPU first
    const [modelSize, setModelSize] = useState('gpu' in navigator ? 196 : 77); // WebGPU=196MB, WebAssembly=77MB
    useEffect(() => {
        hasWebGPU().then((b) => {
            setModelSize(b ? 196 : 77);
            setDevice(b ? 'webgpu' : 'wasm');
        });
    }, []);

    // Notion integration
    const [notionClient, setNotionClient] = useState(null);
    const [currentNotionPage, setCurrentNotionPage] = useState(null);
    const [selectedNotionPage, setSelectedNotionPage] = useState(null);
    const [notionStatus, setNotionStatus] = useState(''); // Add status for notification
    const lastProcessedSegment = useRef(null);

    // Batch processing for GPT
    const [pendingTranscriptBatch, setPendingTranscriptBatch] = useState([]);
    const [batchCounter, setBatchCounter] = useState(0);
    const BATCH_SIZE = 10; // Process every 10 transcriptions

    // Automatically clear Notion status after 3 seconds
    useEffect(() => {
        if (!notionStatus) return;
        
        const timeoutId = setTimeout(() => {
            setNotionStatus('');
        }, 3000);
        
        return () => clearTimeout(timeoutId);
    }, [notionStatus]);

    // Handle Notion OAuth-based authentication
    const handleNotionConnect = useCallback(async ({ code, redirectUri }) => {
        try {
            console.log('Received authorization code from Notion', { code, redirectUri });
            // Get the client ID from localStorage (set during auth initiation)
            const clientId = localStorage.getItem('notion_client_id');
            
            setNotionStatus('Connecting to Notion...');
            
            let tokenData;
            try {
                // Try to use our serverless function to exchange the code for a token
                tokenData = await getNotionAccessToken(code, redirectUri);
                console.log('Successfully obtained token from Notion API');
            } catch (tokenError) {
                console.error('Error getting token from Notion API:', tokenError);
                
                // If the serverless function isn't deployed yet or fails, use simulated tokens as fallback
                setNotionStatus('Using demo mode due to server error');
                console.log('Falling back to simulated token for demo purposes');
                tokenData = simulateNotionToken(code);
            }
            
            // Create Notion client with the access token
            const client = new NotionClient(tokenData.access_token);
            setNotionClient(client);
            setNotionStatus('Successfully connected to Notion!');
            
            // Store token data (in a production app, should be stored securely)
            localStorage.setItem('notion_access_token', tokenData.access_token);
            if (tokenData.workspace_id) {
                localStorage.setItem('notion_workspace_id', tokenData.workspace_id);
            }
        } catch (error) {
            console.error('Failed to connect to Notion:', error);
            setNotionStatus(`Error connecting to Notion: ${error.message}`);
        }
    }, []);

    // Handle selecting a specific Notion page
    const handleSelectNotionPage = useCallback((page) => {
        console.log('Selected Notion page:', page);
        if (!page || !page.id) {
            console.error('Invalid page selected:', page);
            setNotionStatus('Error: Invalid page selected');
            return;
        }
        
        // Store the page immediately to ensure it's available for transcription
        setSelectedNotionPage(page);
        
        // If we're already recording, update the current page
        if (isRecording) {
            console.log('Already recording, updating current page to:', page.id);
            setCurrentNotionPage(page);
            setNotionStatus(`Switched to Notion page: ${getPageTitle(page)}`);
        }
    }, [isRecording]);

    // Create a new Notion page when starting recording (if no page is selected)
    useEffect(() => {
        if (isRecording && notionClient) {
            if (selectedNotionPage) {
                // Use the selected page
                console.log('Using selected Notion page:', selectedNotionPage.id);
                setCurrentNotionPage(selectedNotionPage);
                setNotionStatus(`Using Notion page: ${getPageTitle(selectedNotionPage)}`);
            } else if (!currentNotionPage) {
                // Create a new page if none selected
                const createPage = async () => {
                    try {
                        // Since we're not using API key method anymore, we need to get database from selected page
                        const databases = await notionClient.getUserDatabases();
                        if (databases && databases.length > 0) {
                            const title = `Meeting Transcript - ${new Date().toLocaleString()}`;
                            console.log(`Creating new page "${title}" in database ${databases[0].id}`);
                            
                            setNotionStatus(`Creating new Notion page...`);
                            
                            const page = await notionClient.createPage(
                                databases[0].id,
                                title
                            );
                            
                            console.log('Created new Notion page:', page);
                            setCurrentNotionPage(page);
                            setNotionStatus(`Created new Notion page: ${title}`);
                        } else {
                            console.error('No databases available to create page');
                            setNotionStatus('Error: No Notion databases available');
                        }
                    } catch (error) {
                        console.error('Failed to create Notion page:', error);
                        setNotionStatus(`Error creating Notion page: ${error.message}`);
                    }
                };
                createPage();
            }
        } else if (!isRecording) {
            setCurrentNotionPage(null);
        }
    }, [isRecording, notionClient, selectedNotionPage, currentNotionPage]);

    // Update Notion page with new transcripts
    useEffect(() => {
        if (!currentNotionPage || !notionClient || !realtimeTranscript.segments.length) return;

        const updateNotion = async () => {
            try {
                // Get new segments that haven't been processed
                const newSegments = realtimeTranscript.segments.filter(seg => {
                    const isNew = !lastProcessedSegment.current || 
                        seg.start > lastProcessedSegment.current.start ||
                        (seg.start === lastProcessedSegment.current.start && seg.end > lastProcessedSegment.current.end);
                    
                    return isNew && seg.text.trim().length > 0;
                });
                
                if (newSegments.length === 0) return;
                
                console.log(`📝 Updating Notion with ${newSegments.length} new segments`);
                setNotionStatus(`Adding ${newSegments.length} new segment(s) to Notion...`);
                
                // Process each segment separately to preserve speaker information
                for (const segment of newSegments) {
                    // Format text with speaker label if available
                    const formattedText = segment.speaker 
                        ? `[${segment.speaker}] ${segment.text.trim()}`
                        : segment.label 
                            ? `[Speaker ${segment.label}] ${segment.text.trim()}`
                            : segment.text.trim();
                    
                    console.log(`Sending to Notion: "${formattedText}"`);
                    
                    try {
                        // Send to Notion
                        await notionClient.appendToPage(
                            currentNotionPage.id,
                            formattedText,
                            segment.label || segment.speaker
                        );
                        
                        console.log(`✅ Added to Notion: ${formattedText}`);
                    } catch (appendError) {
                        console.error(`Failed to append segment to Notion: ${appendError.message}`);
                    }
                    
                    // Update last processed segment after each successful append
                    lastProcessedSegment.current = segment;
                }
                
                setNotionStatus(`Successfully added to Notion!`);
            } catch (error) {
                console.error('❌ Failed to update Notion:', error);
                // Show error to user in a production app
                console.error(error);
                setNotionStatus(`Error adding to Notion: ${error.message}`);
            }
        };
        
        // Call immediately when there are new segments
        updateNotion();
        
        // Also set up an interval to periodically check for updates
        const intervalId = setInterval(updateNotion, 5000); // Check every 5 seconds
        
        return () => {
            clearInterval(intervalId); // Clean up interval on unmount or dependency change
        };
    }, [realtimeTranscript, currentNotionPage, notionClient]);

    // Reset batching when recording is stopped
    useEffect(() => {
        if (!isRecording) {
            // Process any remaining transcripts in the batch
            if (pendingTranscriptBatch.length > 0 && notionClient && currentNotionPage) {
                processTranscriptBatch();
            }
            // Reset batch counter and pending batch
            setBatchCounter(0);
            setPendingTranscriptBatch([]);
        }
    }, [isRecording]);
    
    // Function to process a batch of transcripts
    const processTranscriptBatch = async () => {
        if (!notionClient || !currentNotionPage || pendingTranscriptBatch.length === 0) return;
        
        try {
            setNotionStatus(`Processing batch of ${pendingTranscriptBatch.length} transcripts...`);
            
            // 1. Read the current page content
            let pageContent = '';
            try {
                const pageData = await notionClient.readPage(currentNotionPage.id);
                pageContent = pageData.content || '';
                console.log('Current page content length:', pageContent.length);
            } catch (readError) {
                console.error('Error reading page:', readError);
                // Continue with empty content if reading fails
            }
            
            // 2. Enhance the transcript with GPT-4o-mini
            setNotionStatus('Enhancing transcript with GPT-4o-mini...');
            const enhancedResult = await enhanceWholeTranscript(
                pageContent,
                pendingTranscriptBatch
            );
            
            // 3. Update the Notion page, preserving history
            if (enhancedResult.success) {
                console.log('Enhanced content:', enhancedResult.enhanced);
                setNotionStatus('Updating Notion page with enhanced transcript...');
                
                // Use updateEntirePage with preserveHistory=true (default)
                await notionClient.updateEntirePage(
                    currentNotionPage.id,
                    enhancedResult.enhanced
                );
                
                console.log('✅ Successfully updated Notion page with enhanced content');
                setNotionStatus('Updated Notion page with enhanced transcript');
            } else {
                // Fallback to basic formatting if enhancement fails
                console.log('Using basic formatting due to enhancement failure');
                
                const formattedText = pendingTranscriptBatch.map(seg => 
                    seg.speaker ? `### Speaker ${seg.speaker}\n${seg.text.trim()}` : seg.text.trim()
                ).join('\n\n');
                
                // Use updateEntirePage with preserveHistory=true (default)
                await notionClient.updateEntirePage(
                    currentNotionPage.id,
                    formattedText
                );
                
                console.log('✅ Updated Notion page with basic formatting');
                setNotionStatus('Updated Notion page with basic formatting');
            }
            
            // Clear the batch after processing
            setPendingTranscriptBatch([]);
        } catch (error) {
            console.error('Error processing transcript batch:', error);
            setNotionStatus(`Error: ${error.message}`);
        }
    };

    // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
    useEffect(() => {
        if (!worker.current) {
            worker.current = new Worker(new URL('./worker.js', import.meta.url), {
                type: 'module'
            });
        }

        const onMessageReceived = async (e) => {
            // Debug all worker messages
            console.log('Worker message received:', e.data.type, e.data);
            
            if (e.data.type === 'chunk_complete' && isRealtime && e.data.result?.transcript) {
                // Skip logging if it's just [BLANK_AUDIO]
                if (e.data.result.transcript.trim() === '[BLANK_AUDIO]') return;

                // Only process if we have actual speech content
                const hasContent = e.data.result.segments.some(seg => 
                    seg.text.trim() && !seg.text.includes('[BLANK_AUDIO]')
                );

                if (hasContent) {
                    // More verbose logging to debug
                    console.log(`\n💬 TRANSCRIPTION UPDATE (segments: ${e.data.result.segments.length}):`, e.data.result);
                    
                    // Update realtimeTranscript state with new segments
                    setRealtimeTranscript(prev => {
                        const newTranscript = {
                            transcript: e.data.result.transcript,
                            segments: [...prev.segments, ...e.data.result.segments]
                        };
                        return newTranscript;
                    });
                    
                    // Add valid segments to the pending batch
                    const validSegments = e.data.result.segments.filter(seg => 
                        seg.text.trim() && !seg.text.includes('[BLANK_AUDIO]')
                    );
                    
                    if (validSegments.length > 0 && notionClient && currentNotionPage) {
                        // Log segments
                        validSegments.forEach(seg => {
                            console.log(`${seg.label}: "${seg.text.trim()}"`);
                        });
                        
                        // Add to pending batch
                        setPendingTranscriptBatch(prev => [
                            ...prev, 
                            ...validSegments.map(seg => ({ 
                                text: seg.text.trim(), 
                                speaker: seg.label 
                            }))
                        ]);
                        
                        // Increment batch counter
                        const newCount = batchCounter + validSegments.length;
                        setBatchCounter(newCount);
                        
                        // Process batch if we've reached the threshold
                        if (newCount >= BATCH_SIZE) {
                            console.log(`Batch threshold reached (${newCount}). Processing batch...`);
                            setBatchCounter(0);
                            processTranscriptBatch();
                        } else {
                            console.log(`Added to batch. Current count: ${newCount}/${BATCH_SIZE}`);
                        }
                    }
                    
                    console.log('------------------------');
                }
                return;
            }

            switch (e.data.status) {
                case 'loading':
                    setStatus('loading');
                    setLoadingMessage(e.data.data);
                    break;

                case 'initiate':
                    setProgressItems(prev => [...prev, e.data]);
                    break;

                case 'progress':
                    setProgressItems(
                        prev => prev.map(item => {
                            if (item.file === e.data.file) {
                                return { ...item, ...e.data }
                            }
                            return item;
                        })
                    );
                    break;

                case 'done':
                    setProgressItems(
                        prev => prev.filter(item => item.file !== e.data.file)
                    );
                    break;

                case 'loaded':
                    setStatus('ready');
                    break;

                case 'complete':
                    setStatus('ready');
                    break;

                case 'error':
                    console.error('❌ Error:', e.data.error);
                    break;
            }
        };

        worker.current.addEventListener('message', onMessageReceived);

        return () => {
            worker.current.removeEventListener('message', onMessageReceived);
        };
    }, [isRealtime, notionClient, currentNotionPage, batchCounter, pendingTranscriptBatch]);

    const handleClick = useCallback(() => {
        setResult(null);
        setTime(null);
        if (status === null) {
            setStatus('loading');
            worker.current.postMessage({ type: 'load', data: { device } });
        } else {
            setStatus('running');
            worker.current.postMessage({
                type: 'run', data: { audio, language }
            });
        }
    }, [status, audio, language, device]);

    const handleAudioChunk = useCallback((chunk) => {
        if (worker.current && status === 'ready' && isRecording) {
            worker.current.postMessage({
                type: 'audioChunk',
                data: { chunk, language }
            });
        }
    }, [status, isRecording, language]);

    const toggleRecording = useCallback(() => {
        if (!isRecording) {
            setRealtimeTranscript({ transcript: '', segments: [] });
            setIsRealtime(true);
            setIsRecording(true);
            lastProcessedSegment.current = null;
        } else {
            setIsRecording(false);
            if (worker.current) {
                worker.current.postMessage({ type: 'cleanup' });
            }
        }
    }, [isRecording]);

    // Add cleanup on unmount
    useEffect(() => {
        return () => {
            if (worker.current) {
                worker.current.postMessage({ type: 'cleanup' });
                worker.current.terminate();
            }
        };
    }, []);

    // Cleanup transcripts periodically to prevent memory buildup
    useEffect(() => {
        if (!isRecording || !isRealtime) return;

        const cleanupInterval = setInterval(() => {
            setRealtimeTranscript(prev => {
                // Keep only the last 5 minutes of transcripts
                const fiveMinutesAgo = performance.now() / 1000 - 300;
                return {
                    transcript: prev.transcript,
                    segments: prev.segments.filter(seg => seg.end > fiveMinutesAgo)
                };
            });
        }, 60000); // Clean up every minute

        return () => clearInterval(cleanupInterval);
    }, [isRecording, isRealtime]);

    // Monitor recording state changes
    useEffect(() => {
        if (isRecording) {
            console.log('Recording started');
            // Any recording start logic can go here
        } else {
            console.log('Recording stopped');
            setNotionStatus('Recording stopped. Transcription complete.');
            // Any recording stop logic can go here
        }
    }, [isRecording]);

    // Handle worker messages (transcription results)
    const handleWorkerMessage = useCallback((e) => {
        if (e.data.type === 'chunk_complete') {
            if (e.data.result?.transcript) {
                console.log('\n📝 New transcription:', e.data.result.transcript);
                
                if (e.data.result.segments?.length > 0) {
                    console.log('👥 Speakers:');
                    e.data.result.segments.forEach(segment => {
                        console.log(`${segment.label}: ${segment.text}`);
                    });
                    console.log('------------------------');
                }
            }
        } else if (e.data.type === 'error') {
            console.error('❌ Worker error:', e.data.error);
        }
        
        // If we get a real-time transcript segment, send it to Notion immediately
        if (e.data.type === 'realtime' && e.data.data && e.data.data.segments && e.data.data.segments.length > 0) {
            console.log('Received realtime transcript with segments:', e.data.data.segments.length);
            
            // Send the latest segment directly to Notion if we're connected
            const segments = e.data.data.segments;
            if (segments.length > 0 && notionClient && currentNotionPage) {
                const latestSegment = segments[segments.length - 1];
                
                // Only send if the segment has text
                if (latestSegment.text && latestSegment.text.trim()) {
                    // Format text with speaker label if available
                    const formattedText = latestSegment.speaker 
                        ? `[${latestSegment.speaker}] ${latestSegment.text.trim()}`
                        : latestSegment.label 
                            ? `[Speaker ${latestSegment.label}] ${latestSegment.text.trim()}`
                            : latestSegment.text.trim();
                    
                    console.log('Sending latest segment to Notion immediately:', formattedText);
                    
                    // Send to Notion without awaiting (fire and forget)
                    notionClient.appendToPage(currentNotionPage.id, formattedText, latestSegment.label || latestSegment.speaker)
                        .then(() => console.log('Successfully sent segment to Notion'))
                        .catch(err => console.error('Failed to send segment to Notion:', err));
                }
            }
        }
    }, [notionClient, currentNotionPage]);

    return (
        <div className="flex flex-col h-screen mx-auto text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 max-w-[600px]">

            {status === 'loading' && (
                <div className="flex justify-center items-center fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] top-0 left-0">
                    <div className="w-[500px]">
                        <p className="text-center mb-1 text-white text-md">{loadingMessage}</p>
                        {progressItems.map(({ file, progress, total }, i) => (
                            <Progress key={i} text={file} percentage={progress} total={total} />
                        ))}
                    </div>
                </div>
            )}
            <div className="my-auto">
                <div className="flex flex-col items-center mb-2 text-center">
                    <h1 className="text-5xl font-bold mb-2">Whisper Diarization</h1>
                    <h2 className="text-xl font-semibold">In-browser real-time speech recognition w/ <br />word-level timestamps and speaker segmentation</h2>
                </div>

                <div className="w-full min-h-[220px] flex flex-col justify-center items-center">
                    <div className="flex flex-col w-full m-3 max-w-[520px] gap-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm mb-0.5">Microphone Input</span>
                            <div className="flex space-x-2">
                                {/* OAuth-based connection */}
                                <NotionAuth 
                                    onConnect={handleNotionConnect}
                                    isConnected={!!notionClient}
                                />
                                
                                {/* Page selector (only visible when connected) */}
                                {notionClient && (
                                    <NotionPageSelector
                                        notionClient={notionClient}
                                        onSelectPage={handleSelectNotionPage}
                                        selectedPageId={selectedNotionPage?.id}
                                    />
                                )}
                            </div>
                        </div>
                        
                        {/* Notion status notification */}
                        {notionStatus && (
                            <div className={`px-4 py-2 rounded-md text-sm transition-opacity duration-500 ${notionStatus.includes('Error') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                                {notionStatus}
                            </div>
                        )}
                        
                        {/* Display current Notion target when connected and recording */}
                        {isRecording && currentNotionPage && (
                            <div className="mb-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-md dark:bg-blue-900 dark:text-blue-200">
                                <div className="text-xs">Sending transcription to Notion:</div>
                                <div className="text-sm font-medium truncate">
                                    {selectedNotionPage ? getPageTitle(selectedNotionPage) : 'New transcript page'}
                                </div>
                            </div>
                        )}
                        
                        <MicrophoneInput
                            isRecording={isRecording}
                            onAudioChunk={handleAudioChunk}
                        />

                        <div>
                            <span className="text-sm mb-0.5">Or upload audio/video file</span>
                            <MediaInput
                                ref={mediaInputRef}
                                className="flex items-center border rounded-md cursor-pointer min-h-[100px] max-h-[500px] overflow-hidden"
                                onInputChange={(audio) => {
                                    setIsRealtime(false);
                                    setResult(null);
                                    setAudio(audio);
                                }}
                                onTimeUpdate={(time) => setCurrentTime(time)}
                            />
                        </div>
                    </div>

                    <div className="relative w-full flex justify-center items-center gap-4">
                        {status === 'ready' && (
                            <button
                                className={`border px-4 py-2 rounded-lg ${isRecording ? 'bg-red-400 hover:bg-red-500' : 'bg-blue-400 hover:bg-blue-500'} text-white`}
                                onClick={toggleRecording}
                            >
                                {isRecording ? 'Stop Recording' : 'Start Recording'}
                            </button>
                        )}

                        <button
                            className="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none"
                            onClick={handleClick}
                            disabled={status === 'running' || isRecording}
                        >
                            {status === null ? 'Load model' :
                                status === 'running'
                                    ? 'Running...'
                                    : 'Start'
                            }
                        </button>

                        {status !== null &&
                            <div className='absolute right-0 bottom-0'>
                                <span className="text-xs">Language:</span>
                                <br />
                                <LanguageSelector 
                                    className="border rounded-lg p-1 max-w-[100px]" 
                                    language={language} 
                                    setLanguage={setLanguage} 
                                />
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div >
    )
}

// Helper to get Notion page title
const getPageTitle = (page) => {
    try {
        if (!page) return 'Untitled Page';
        
        // Try to find title property
        const titleProperty = Object.values(page.properties || {}).find(
            prop => prop?.type === 'title'
        );
        
        if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
            return titleProperty.title.map(t => t.plain_text).join('');
        }
        
        // If no title property found, try to use the name property
        const nameProperty = page.properties?.Name || page.properties?.name;
        if (nameProperty && nameProperty.title && nameProperty.title.length > 0) {
            return nameProperty.title.map(t => t.plain_text).join('');
        }
        
        // If nothing else works, use the page ID
        return `Page ${page.id.slice(0, 8)}...`;
    } catch (err) {
        console.error('Error getting page title:', err, page);
        return 'Untitled Page';
    }
};

export default App
