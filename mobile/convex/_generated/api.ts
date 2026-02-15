/* Re-export from the real Convex generated API.
 * The runtime api.js uses `anyApi` from convex/server which
 * dynamically routes function calls to the Convex backend.
 */
import { anyApi } from "convex/server";

export const api: any = anyApi;
export const internal: any = anyApi;
