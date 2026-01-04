/**
 * Cloudflare AI Application with Hono, Workers AI, and Durable Objects
 *
 * - Run `npm run dev` to start development server
 * - Run `npm run deploy` to publish your worker
 * - Run `npm run cf-typegen` to regenerate type definitions after updating wrangler.toml
 */

import { Hono } from 'hono';
import { ChatRoom } from './ChatRoom';

// Define the Hono app with Cloudflare Workers bindings
const app = new Hono<{ Bindings: Env }>();

/**
 * Serve the chat UI at the root
 */
app.get('/', async (c) => {
	try {
		// Fetch the index.html from the Assets binding
		const asset = await c.env.ASSETS.fetch(new Request('http://dummy/index.html'));
		return new Response(asset.body, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
			},
		});
	} catch (error) {
		console.error('Error serving static file:', error);
		return c.json({ 
			message: 'Cloudflare AI Application', 
			status: 'ready',
			endpoints: {
				chat: '/api/chat?username=YourName'
			}
		});
	}
});

/**
 * Chat room route - Upgrades WebSocket connection to ChatRoom Durable Object
 * Query params: username (optional, defaults to "Anonymous")
 */
app.get('/api/chat', async (c) => {
	// Get the Durable Object namespace binding
	const durableObjectNamespace = c.env.CHAT_ROOM;

	// Generate a stable ID for the chat room
	// Using a fixed name ensures all users connect to the same room
	const roomId = durableObjectNamespace.idFromName('global-chat-room');

	// Get the Durable Object stub
	const stub = durableObjectNamespace.get(roomId);

	// Forward the request to the Durable Object
	// The DO will handle the WebSocket upgrade
	return stub.fetch(c.req.raw);
});

// Export the Hono app as a Cloudflare Worker
export default app;

// Export Durable Object classes
export { ChatRoom };
