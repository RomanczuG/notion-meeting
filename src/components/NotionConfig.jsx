import { useState } from 'react';

const NotionConfig = ({ onSave, isConnected }) => {
    const [apiKey, setApiKey] = useState('');
    const [databaseId, setDatabaseId] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ apiKey, databaseId });
        setIsVisible(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsVisible(!isVisible)}
                className={`px-3 py-1 rounded-lg text-sm ${
                    isConnected ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
            >
                {isConnected ? 'Connected to Notion' : 'Connect Notion'}
            </button>

            {isVisible && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Notion API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                placeholder="secret_..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Database ID
                            </label>
                            <input
                                type="text"
                                value={databaseId}
                                onChange={(e) => setDatabaseId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                placeholder="database_id..."
                            />
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
                                type="submit"
                                className="px-3 py-1 text-sm rounded-md bg-blue-500 text-white"
                            >
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default NotionConfig; 