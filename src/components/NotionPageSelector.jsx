import { useState, useEffect } from 'react';

const NotionPageSelector = ({ notionClient, onSelectPage, selectedPageId }) => {
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDatabase, setSelectedDatabase] = useState(null);
    const [pages, setPages] = useState([]);
    const [loadingPages, setLoadingPages] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Load available databases when component mounts
    useEffect(() => {
        if (notionClient && isVisible) {
            loadDatabases();
        }
    }, [notionClient, isVisible]);

    // Load pages when a database is selected
    useEffect(() => {
        if (selectedDatabase) {
            loadPages(selectedDatabase.id);
        }
    }, [selectedDatabase]);

    const loadDatabases = async () => {
        if (!notionClient) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const databases = await notionClient.getUserDatabases();
            console.log('Loaded databases:', databases);
            setDatabases(databases);
            
            // If we have databases, select the first one by default
            if (databases.length > 0) {
                setSelectedDatabase(databases[0]);
            }
        } catch (err) {
            console.error('Error loading Notion databases:', err);
            setError('Failed to load Notion databases. Please check your API key and permissions.');
        } finally {
            setLoading(false);
        }
    };

    const loadPages = async (databaseId) => {
        if (!notionClient) return;
        
        setLoadingPages(true);
        setPages([]);
        setError(null);
        
        try {
            console.log(`Loading pages for database: ${databaseId}`);
            const pages = await notionClient.getDatabasePages(databaseId);
            console.log('Loaded pages:', pages);
            setPages(pages || []);
        } catch (err) {
            console.error('Error loading Notion pages:', err);
            setError('Failed to load pages from the selected database.');
        } finally {
            setLoadingPages(false);
        }
    };

    const handleSelectDatabase = (database) => {
        setSelectedDatabase(database);
    };

    const handleSelectPage = (page) => {
        onSelectPage(page);
        setIsVisible(false);
    };

    // Get page title from Notion page object
    const getPageTitle = (page) => {
        // Notion page titles can be in different formats
        try {
            // Try to find title property
            const titleProperty = Object.values(page.properties).find(
                prop => prop.type === 'title'
            );
            
            if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
                return titleProperty.title.map(t => t.plain_text).join('');
            }
            
            // If no title property found, try to use the name property
            const nameProperty = page.properties.Name || page.properties.name;
            if (nameProperty && nameProperty.title && nameProperty.title.length > 0) {
                return nameProperty.title.map(t => t.plain_text).join('');
            }
            
            // If nothing else works, use the page ID
            return `Page ${page.id.slice(0, 8)}...`;
        } catch (err) {
            console.error('Error getting page title:', err);
            return 'Untitled';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="px-3 py-1 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
                {selectedPageId ? 'Change Notion Page' : 'Select Notion Page'}
            </button>

            {isVisible && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium mb-2">Select Notion Page</h3>
                        
                        {error && (
                            <div className="text-red-500 text-sm mb-2">{error}</div>
                        )}
                        
                        {loading ? (
                            <div className="text-sm text-gray-500">Loading databases...</div>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-1">Database</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                        value={selectedDatabase?.id || ''}
                                        onChange={(e) => {
                                            const db = databases.find(db => db.id === e.target.value);
                                            handleSelectDatabase(db);
                                        }}
                                    >
                                        {databases.length === 0 ? (
                                            <option value="">No databases found</option>
                                        ) : (
                                            databases.map(db => (
                                                <option key={db.id} value={db.id}>
                                                    {db.title?.[0]?.plain_text || db.properties?.title?.title?.[0]?.plain_text || 'Untitled Database'}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                {selectedDatabase && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Page</label>
                                        {loadingPages ? (
                                            <div className="text-sm text-gray-500">Loading pages...</div>
                                        ) : pages.length > 0 ? (
                                            <div className="max-h-60 overflow-y-auto border rounded-md">
                                                <ul className="divide-y">
                                                    {pages.map(page => (
                                                        <li 
                                                            key={page.id}
                                                            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                                            onClick={() => handleSelectPage(page)}
                                                        >
                                                            {getPageTitle(page)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-500">No pages found in this database</div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                        
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsVisible(false)}
                                className="px-3 py-1 text-sm rounded-md bg-gray-200 text-gray-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotionPageSelector; 