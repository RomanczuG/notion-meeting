import { onRequest as __api_gpt_enhance_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/gpt/enhance.js"
import { onRequest as __api_notion_append_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/notion/append.js"
import { onRequest as __api_notion_create_page_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/notion/create-page.js"
import { onRequest as __api_notion_databases_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/notion/databases.js"
import { onRequest as __api_notion_oauth_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/notion/oauth.js"
import { onRequest as __api_notion_pages_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/notion/pages.js"
import { onRequest as __api_notion_read_page_js_onRequest } from "/Users/mateusz/Projects/notion-meeting/functions/api/notion/read-page.js"

export const routes = [
    {
      routePath: "/api/gpt/enhance",
      mountPath: "/api/gpt",
      method: "",
      middlewares: [],
      modules: [__api_gpt_enhance_js_onRequest],
    },
  {
      routePath: "/api/notion/append",
      mountPath: "/api/notion",
      method: "",
      middlewares: [],
      modules: [__api_notion_append_js_onRequest],
    },
  {
      routePath: "/api/notion/create-page",
      mountPath: "/api/notion",
      method: "",
      middlewares: [],
      modules: [__api_notion_create_page_js_onRequest],
    },
  {
      routePath: "/api/notion/databases",
      mountPath: "/api/notion",
      method: "",
      middlewares: [],
      modules: [__api_notion_databases_js_onRequest],
    },
  {
      routePath: "/api/notion/oauth",
      mountPath: "/api/notion",
      method: "",
      middlewares: [],
      modules: [__api_notion_oauth_js_onRequest],
    },
  {
      routePath: "/api/notion/pages",
      mountPath: "/api/notion",
      method: "",
      middlewares: [],
      modules: [__api_notion_pages_js_onRequest],
    },
  {
      routePath: "/api/notion/read-page",
      mountPath: "/api/notion",
      method: "",
      middlewares: [],
      modules: [__api_notion_read_page_js_onRequest],
    },
  ]