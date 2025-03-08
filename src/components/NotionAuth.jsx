import { useState, useEffect } from 'react';
import { getNotionAuthUrl } from '../utils/notion';

const NotionAuth = ({ onConnect, isConnected }) => {
    // Pre-fill with user's client ID
    const [clientId, setClientId] = useState('1b0d872b-594c-804e-a615-00370106cfff');
    const [redirectUri, setRedirectUri] = useState(window.location.origin);
    const [isVisible, setIsVisible] = useState(false);

    // Check if we're returning from OAuth redirect
    useEffect(() => {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        
        if (code) {
            // Remove code from URL to prevent reusing it
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Pass the code to parent component
            onConnect({ code, redirectUri: window.location.origin });
        }
    }, [onConnect]);

    const handleConnect = () => {
        // Save client ID to localStorage (needed after redirect)
        localStorage.setItem('notion_client_id', clientId);
        localStorage.setItem('notion_redirect_uri', redirectUri);
        
        // Redirect to Notion OAuth page
        const authUrl = getNotionAuthUrl(clientId, redirectUri);
        window.location.href = authUrl;
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsVisible(!isVisible)}
                className={`px-3 py-1 rounded-lg text-sm ${
                    isConnected ? 'bg-green-500 text-white' : 'bg-black text-white'
                }`}
            >
                {isConnected ? 'Connected to Notion' : 'Connect Notion'}
            </button>

            {isVisible && !isConnected && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Notion Integration Client ID
                            </label>
                            <input
                                type="text"
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Enter your Notion integration client ID"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Redirect URI
                            </label>
                            <input
                                type="text"
                                value={redirectUri}
                                onChange={(e) => setRedirectUri(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Enter redirect URI"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                This should match the redirect URI in your Notion integration settings
                            </p>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                type="button"
                                onClick={() => setIsVisible(false)}
                                className="px-3 py-1 text-sm rounded-md bg-gray-200 text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConnect}
                                className="px-3 py-1 text-sm rounded-md bg-black text-white"
                            >
                                Connect to Notion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotionAuth; 