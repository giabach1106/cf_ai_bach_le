/**
 * ChatRoom Durable Object
 * 
 * This Durable Object acts as a single chat room instance where multiple users
 * can connect via WebSocket, send messages, and receive broadcasts from others.
 * Message history is persisted in Durable Object storage.
 */

import { DurableObject } from 'cloudflare:workers';

// Message structure for chat messages
interface ChatMessage {
	id: string;
	username: string;
	content: string;
	timestamp: number;
}

// WebSocket session wrapper
interface Session {
	webSocket: WebSocket;
	username: string;
}

export class ChatRoom extends DurableObject {
	// In-memory list of active WebSocket sessions
	private sessions: Set<Session>;
	// Storage key for message history
	private readonly HISTORY_KEY = 'message_history';
	// Room ID for vector isolation (extracted from URL)
	private roomId: string = 'default';

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Set();
	}

	/**
	 * Generates a short vector ID for Vectorize (max 64 bytes)
	 * Uses first 8 chars of room ID + first 8 chars of message ID = 17 chars
	 */
	private getVectorId(messageId: string): string {
		// Shorten to fit Vectorize's 64 byte limit
		const shortRoom = this.roomId.substring(0, 8);
		const shortMsg = messageId.substring(0, 8);
		return `${shortRoom}_${shortMsg}`;
	}

	/**
	 * Handles incoming HTTP requests, including WebSocket upgrades
	 */
	async fetch(request: Request): Promise<Response> {
		// Check if this is a WebSocket upgrade request
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		// Extract room ID from query parameters for vector isolation
		const url = new URL(request.url);
		this.roomId = url.searchParams.get('room') || 'default';

		// Create WebSocket pair
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Accept the WebSocket connection
		server.accept();

		// Create session object (username is always "User" now)
		const session: Session = {
			webSocket: server,
			username: 'User',
		};

		// Add session to active sessions
		this.sessions.add(session);

		// Set up event handlers for this WebSocket
		server.addEventListener('message', async (event) => {
			await this.handleMessage(session, event.data as string);
		});

		server.addEventListener('close', () => {
			this.sessions.delete(session);
		});

		server.addEventListener('error', () => {
			this.sessions.delete(session);
		});

		// Send message history to newly connected user
		await this.sendHistory(session);

		// Return the client WebSocket to complete the upgrade
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	/**
	 * Handles incoming messages from a user
	 */
	private async handleMessage(session: Session, messageData: string): Promise<void> {
		try {
			// Parse incoming message
			const data = JSON.parse(messageData);

			// Check for special commands
			if (data.type === 'clear_history') {
				await this.clearHistory();
				
				// Notify all users that history was cleared
				const clearNotification = JSON.stringify({
					type: 'history_cleared',
				});
				
				for (const s of this.sessions) {
					try {
						s.webSocket.send(clearNotification);
					} catch (error) {
						console.error('Error sending clear notification:', error);
					}
				}
				
				// Broadcast system message
				const systemMessage: ChatMessage = {
					id: crypto.randomUUID(),
					username: 'System',
					content: `${session.username} cleared the chat history`,
					timestamp: Date.now(),
				};
				await this.broadcastMessage(systemMessage);
				return;
			}

		// Create chat message (username is always "User" for simplicity)
		const message: ChatMessage = {
			id: crypto.randomUUID(),
			username: 'User',
			content: data.content || '',
			timestamp: Date.now(),
		};

		// Store message in history
		await this.addMessageToHistory(message);

		// Broadcast to all connected sessions (including sender)
		await this.broadcastMessage(message);

			// Check if this is an AI trigger message
			if (message.content.trim().startsWith('@ai')) {
				// Extract the prompt (remove "@ai" prefix)
				const prompt = message.content.trim().substring(3).trim();
				
				if (prompt) {
					// Trigger AI response with streaming
					await this.handleAIRequest(prompt, session);
				} else {
					// Send error if no prompt provided
					session.webSocket.send(
						JSON.stringify({
							type: 'error',
							message: 'Please provide a prompt after @ai',
						})
					);
				}
			}
		} catch (error) {
			console.error('Error handling message:', error);
			session.webSocket.send(
				JSON.stringify({
					type: 'error',
					message: 'Failed to process message',
				})
			);
		}
	}

	/**
	 * Generates text embedding using Workers AI with retry logic
	 */
	private async generateEmbedding(text: string, retries = 3): Promise<number[]> {
		// Truncate text to prevent too large input (max ~512 tokens for BGE model)
		const truncatedText = text.substring(0, 1000);
		
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				const response = await this.env.AI.run(
					'@cf/baai/bge-base-en-v1.5',
					{ text: [truncatedText] }
				) as { data: number[][] };
				
				if (!response?.data?.[0]) {
					throw new Error('Invalid embedding response');
				}
				
				// Success - return the embedding
				if (attempt > 1) {
					console.log(`[RAG] Embedding generation succeeded on attempt ${attempt}`);
				}
				return response.data[0];
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				console.error(`[RAG] Embedding error (attempt ${attempt}/${retries}):`, errorMsg);
				
				// If this was the last attempt, throw the error
				if (attempt === retries) {
					console.error('[RAG] All embedding attempts failed');
					throw error;
				}
				
				// Exponential backoff before retry (500ms, 1s, 2s...)
				const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
				console.log(`[RAG] Retrying in ${delay}ms...`);
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
		
		// Should never reach here, but TypeScript needs it
		throw new Error('Embedding generation failed after all retries');
	}

	/**
	 * Handles AI request with streaming response
	 */
	private async handleAIRequest(prompt: string, requestingSession: Session): Promise<void> {
		const aiMessageId = crypto.randomUUID();
		let fullResponse = '';

		try {
			// Notify all users that AI is thinking
			const thinkingNotification = JSON.stringify({
				type: 'ai_thinking',
				messageId: aiMessageId,
			});

			for (const session of this.sessions) {
				try {
					session.webSocket.send(thinkingNotification);
				} catch (error) {
					console.error('Error sending thinking notification:', error);
				}
			}

			// RAG: Retrieve relevant context from Vectorize AND recent DO storage
			let contextString = '';
			let foundContextCount = 0;
			let debugInfo: string[] = [];
			let ragFailed = false;
			
			// FIRST: Get recent messages from DO storage (immediate context, no eventual consistency)
			const recentHistory = await this.getHistory();
			const recentMessages = recentHistory
				.filter(msg => msg.username !== 'AI Assistant' && msg.username !== 'System')
				.slice(-10) // Last 10 user messages
				.map(msg => `${msg.username}: ${msg.content}`)
				.filter(content => content.toLowerCase() !== `user: ${prompt.toLowerCase()}`); // Exclude current message
			
			console.log(`[RAG] Found ${recentMessages.length} recent messages in DO storage`);
			debugInfo.push(`📋 Recent messages from storage: ${recentMessages.length}`);
			
			try {
				debugInfo.push(`🔍 Generating embedding for: "${prompt.substring(0, 30)}..."`);
				
				// Generate embedding for the user's prompt
				const promptEmbedding = await this.generateEmbedding(prompt);
				console.log(`[RAG] Generated embedding for prompt [room: ${this.roomId}]: "${prompt.substring(0, 50)}..."`);
				debugInfo.push(`✓ Embedding generated (${promptEmbedding.length} dimensions)`);

				// Query Vectorize for top 5 most similar messages (filtered by room ID)
				debugInfo.push(`🔎 Querying Vectorize for similar messages...`);
				let searchResults;
				let queryAttempts = 0;
				const maxQueryAttempts = 2;
				
				while (queryAttempts < maxQueryAttempts) {
					try {
						searchResults = await this.env.VECTORIZE.query(promptEmbedding, {
							topK: 5,
							returnValues: false,
							returnMetadata: 'all',
							filter: { roomId: this.roomId }, // Filter by room ID for isolation
						});
						break; // Success, exit retry loop
					} catch (queryError) {
						queryAttempts++;
						console.error(`[RAG] Vectorize query error (attempt ${queryAttempts}/${maxQueryAttempts}):`, queryError);
						
						if (queryAttempts >= maxQueryAttempts) {
							throw queryError; // Re-throw if all attempts failed
						}
						
						// Wait before retry
						await new Promise(resolve => setTimeout(resolve, 1000));
					}
				}

				if (searchResults) {
					console.log(`[RAG] Vectorize query returned ${searchResults.matches?.length || 0} matches for room: ${this.roomId}`);
					debugInfo.push(`✓ Found ${searchResults.matches?.length || 0} potential matches`);

					// Extract context from matching vectors
					if (searchResults.matches && searchResults.matches.length > 0) {
						const contextMessages = searchResults.matches
							.filter((match) => match.score && match.score > 0.5) // Filter by similarity score
							.map((match) => {
								const content = match.metadata?.content as string;
								const score = match.score?.toFixed(3);
								console.log(`[RAG] Match (score: ${score}): ${content?.substring(0, 50)}...`);
								debugInfo.push(`  📝 Match (${score}): "${content?.substring(0, 40)}..."`);
								return content;
							})
							.filter(Boolean);

						foundContextCount = contextMessages.length;

					if (contextMessages.length > 0) {
						contextString = '\n\n[Context from previous conversation]:\n' + 
							contextMessages.map((msg, i) => `- ${msg}`).join('\n');
						debugInfo.push(`✅ Using ${foundContextCount} context messages for RAG`);
						} else {
							debugInfo.push(`⚠️ No matches above similarity threshold (0.5)`);
						}
					} else {
						debugInfo.push(`ℹ️ No matches found in Vectorize`);
					}

					console.log(`[RAG] Found ${foundContextCount} relevant context messages`);
				}
			} catch (error) {
				ragFailed = true;
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				console.error('[RAG] Context retrieval failed:', errorMsg);
				debugInfo.push(`❌ RAG Error: ${errorMsg}`);
				debugInfo.push(`⚠️ Continuing without RAG context...`);
				
				// Notify user about RAG failure (only if persistent)
				try {
					requestingSession.webSocket.send(
						JSON.stringify({
							type: 'system_message',
							message: '⚠️ Note: Context retrieval temporarily unavailable. AI will respond without previous conversation context.',
						})
					);
				} catch (e) {
					console.error('Error sending RAG failure notification:', e);
				}
			}

			// Send debug info to the requesting user (only if needed for debugging)
			// Set to true to enable RAG debug messages in chat
			const ENABLE_RAG_DEBUG = true;
			
			if (ENABLE_RAG_DEBUG && debugInfo.length > 0) {
				try {
					requestingSession.webSocket.send(
						JSON.stringify({
							type: 'rag_debug',
							info: debugInfo.join('\n'),
						})
					);
				} catch (e) {
					console.error('Error sending debug info:', e);
				}
			}

			// Build system message with context from both sources
			let systemMessage = 'You are a helpful AI assistant in a chat room. Be concise, natural, and friendly.';
			
			// Combine recent messages (from DO storage) with Vectorize results
			const allContext: string[] = [];
			
			// Add recent messages from DO storage (always available, no eventual consistency)
			if (recentMessages.length > 0) {
				allContext.push(...recentMessages);
				console.log(`[RAG] Added ${recentMessages.length} recent messages from DO storage to context`);
			}
			
			// Add Vectorize results if available
			if (contextString) {
				// contextString already contains formatted context from Vectorize
				systemMessage += contextString;
			}
			
			// If we have recent messages but no Vectorize results, use recent messages as context
			if (allContext.length > 0 && !contextString) {
				systemMessage += '\n\n[Recent conversation context]:\n' + 
					allContext.map(msg => `- ${msg}`).join('\n');
				console.log(`[RAG] Using ${allContext.length} recent messages as context (Vectorize had no results)`);
				debugInfo.push(`✅ Using ${allContext.length} recent messages from storage as context`);
			}

			// Call Workers AI with Llama 3.3 model with streaming enabled
			const response = await this.env.AI.run(
				'@cf/meta/llama-3.3-70b-instruct-fp8-fast',
				{
					messages: [
						{
							role: 'system',
							content: systemMessage,
						},
						{
							role: 'user',
							content: prompt,
						},
					],
					stream: true,
				}
			);

			// Process the streaming response
			// Workers AI returns a ReadableStream of Uint8Array chunks (SSE format)
			const decoder = new TextDecoder();
			let buffer = '';

			for await (const chunk of response as AsyncIterable<Uint8Array>) {
				// Decode the Uint8Array to string
				const text = decoder.decode(chunk, { stream: true });
				buffer += text;

				// Split by newlines to process complete SSE messages
				const lines = buffer.split('\n');
				
				// Keep the last incomplete line in the buffer
				buffer = lines.pop() || '';

				for (const line of lines) {
					// SSE format: "data: {...}"
					if (line.startsWith('data: ')) {
						const jsonStr = line.substring(6).trim();
						
						// Skip [DONE] marker
						if (jsonStr === '[DONE]') {
							continue;
						}

						try {
							const data = JSON.parse(jsonStr);
							
							// Extract the response text
							if (data.response) {
								const content = data.response;
								fullResponse += content;

								// Send the chunk immediately to all connected clients
								const streamChunk = JSON.stringify({
									type: 'ai_stream',
									messageId: aiMessageId,
									chunk: content,
								});

								for (const session of this.sessions) {
									try {
										session.webSocket.send(streamChunk);
									} catch (error) {
										console.error('Error sending stream chunk:', error);
										this.sessions.delete(session);
									}
								}
							}
						} catch (parseError) {
							console.error('Error parsing JSON:', parseError, 'Line:', jsonStr);
						}
					}
				}
			}

			// Send completion signal
			const completionSignal = JSON.stringify({
				type: 'ai_complete',
				messageId: aiMessageId,
			});

			for (const session of this.sessions) {
				try {
					session.webSocket.send(completionSignal);
				} catch (error) {
					console.error('Error sending completion signal:', error);
				}
			}

			// Store the complete AI response in history
			if (fullResponse) {
				const aiMessage: ChatMessage = {
					id: aiMessageId,
					username: 'AI Assistant',
					content: fullResponse,
					timestamp: Date.now(),
				};
				await this.addMessageToHistory(aiMessage);
			}

		} catch (error) {
			console.error('Error during AI streaming:', error);

			// Send error to all clients
			const errorMessage = JSON.stringify({
				type: 'ai_error',
				messageId: aiMessageId,
				message: `AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			});

			for (const session of this.sessions) {
				try {
					session.webSocket.send(errorMessage);
				} catch (sendError) {
					console.error('Error sending error message:', sendError);
				}
			}

			// Store error message in history
			const aiErrorMessage: ChatMessage = {
				id: aiMessageId,
				username: 'AI Assistant',
				content: '[AI Error: Failed to generate response]',
				timestamp: Date.now(),
			};
			await this.addMessageToHistory(aiErrorMessage);
		}
	}

	/**
	 * Adds a message to persistent storage
	 */
	private async addMessageToHistory(message: ChatMessage): Promise<void> {
		// Retrieve existing history
		const history = await this.getHistory();

		// Add new message
		history.push(message);

		// Keep only last 100 messages to prevent unbounded growth
		const trimmedHistory = history.slice(-100);

		// Save to storage as JSON string
		await this.ctx.storage.put(this.HISTORY_KEY, JSON.stringify(trimmedHistory));

		// Store user messages in Vectorize for RAG (async, non-blocking)
		if (message.username !== 'System' && message.username !== 'AI Assistant') {
			// Run in background - don't block message storage
			this.storeMessageEmbedding(message).catch(error => {
				console.error('[RAG] Error storing message embedding:', error);
			});
		}
	}

	/**
	 * Stores message embedding in Vectorize (non-blocking background operation)
	 * Uses room-prefixed vector IDs for isolation between rooms
	 * Retries on failure to handle transient Cloudflare service issues
	 */
	private async storeMessageEmbedding(message: ChatMessage, maxRetries = 2): Promise<void> {
		// Strip @ai prefix if present (we want to store the actual content, not the command)
		const contentToStore = message.content.trim().startsWith('@ai')
			? message.content.trim().substring(3).trim()
			: message.content;
		
		// Skip empty messages
		if (!contentToStore || contentToStore.length < 3) {
			console.log(`[RAG] Skipping empty or too short message`);
			return;
		}
		
		// Use room-prefixed vector ID for isolation
		const vectorId = this.getVectorId(message.id);
		console.log(`[RAG] Storing message in Vectorize [room: ${this.roomId}]: "${contentToStore.substring(0, 50)}..."`);
		
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				// Generate embedding for the message content (with built-in retries)
				const embedding = await this.generateEmbedding(contentToStore);
				console.log(`[RAG] Generated embedding with ${embedding.length} dimensions`);

				// Track this vector ID for complete cleanup later
				const allVectorIds = await this.ctx.storage.get<string[]>('all_vector_ids') || [];
				if (!allVectorIds.includes(vectorId)) {
					allVectorIds.push(vectorId);
					// Keep only last 200 IDs to prevent unbounded growth
					const trimmedIds = allVectorIds.slice(-200);
					await this.ctx.storage.put('all_vector_ids', trimmedIds);
				}

				// Insert into Vectorize with retry logic
				let upsertAttempts = 0;
				const maxUpsertAttempts = 2;
				
				while (upsertAttempts < maxUpsertAttempts) {
					try {
						await this.env.VECTORIZE.upsert([
							{
								id: vectorId, // Room-prefixed ID
								values: embedding,
								metadata: {
									content: contentToStore,
									roomId: this.roomId, // Store room ID for filtering
									timestamp: message.timestamp,
								},
							},
						]);
						
						console.log(`[RAG] ✓ Successfully stored vector: ${vectorId}`);
						return; // Success - exit function
					} catch (upsertError) {
						upsertAttempts++;
						console.error(`[RAG] Vectorize upsert error (attempt ${upsertAttempts}/${maxUpsertAttempts}):`, upsertError);
						
						if (upsertAttempts >= maxUpsertAttempts) {
							throw upsertError; // Re-throw if all attempts failed
						}
						
						// Wait before retry
						await new Promise(resolve => setTimeout(resolve, 1000));
					}
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				console.error(`[RAG] Storage attempt ${attempt}/${maxRetries} failed:`, errorMsg);
				
				// If this was the last attempt, log and give up
				if (attempt === maxRetries) {
					console.error(`[RAG] ✗ Failed to store embedding after ${maxRetries} attempts. Giving up.`);
					console.error('[RAG] Message will NOT be available for future RAG queries.');
					// Don't throw - this is a background operation, don't break the chat
					return;
				}
				
				// Exponential backoff before retry
				const delay = 2000 * attempt;
				console.log(`[RAG] Retrying storage in ${delay}ms...`);
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}

	/**
	 * Retrieves message history from storage
	 */
	private async getHistory(): Promise<ChatMessage[]> {
		const historyJson = await this.ctx.storage.get<string>(this.HISTORY_KEY);
		if (!historyJson) {
			return [];
		}
		try {
			return JSON.parse(historyJson);
		} catch (error) {
			console.error('Error parsing history:', error);
			return [];
		}
	}

	/**
	 * Clears all message history from storage and Vectorize
	 * Only deletes vectors belonging to this room (filtered by roomId)
	 */
	private async clearHistory(): Promise<void> {
		console.log(`[RAG] Starting cleanup for room: ${this.roomId}...`);

		// Notify clients that cleanup is starting
		this.broadcastCleanupProgress('starting', 0, 'Starting cleanup...');

		// Step 1: Collect vector IDs from tracked storage (room-prefixed)
		const trackedIds = await this.ctx.storage.get<string[]>('all_vector_ids') || [];
		const history = await this.getHistory();
		const historyIds = history.map(msg => this.getVectorId(msg.id));
		
		// Combine all known IDs for this room
		const allIds = new Set<string>();
		trackedIds.forEach(id => allIds.add(id));
		historyIds.forEach(id => allIds.add(id));
		
		// Filter out IDs that are too long (legacy IDs from before the fix)
		// Vectorize max ID length is 64 bytes
		const validIds = Array.from(allIds).filter(id => {
			const byteLength = new TextEncoder().encode(id).length;
			if (byteLength > 64) {
				console.log(`[RAG] Skipping invalid ID (${byteLength} bytes): ${id.substring(0, 20)}...`);
				return false;
			}
			return true;
		});
		
		this.broadcastCleanupProgress('collecting', 20, `Found ${validIds.length} vectors...`);
		console.log(`[RAG] Found ${validIds.length} valid tracked vectors for room: ${this.roomId}`);

		// Step 2: Also query Vectorize with roomId filter to find any untracked vectors
		try {
			const queryVector = Array.from({ length: 768 }, () => Math.random() * 0.01);
			const queryResult = await this.env.VECTORIZE.query(queryVector, {
				topK: 50, // Max 50 when using returnMetadata: 'all'
				returnValues: false,
				returnMetadata: 'all',
				filter: { roomId: this.roomId },
			});

			const foundIds = queryResult.matches?.map(m => m.id) || [];
			foundIds.forEach(id => {
				if (new TextEncoder().encode(id).length <= 64) {
					allIds.add(id);
				}
			});
			console.log(`[RAG] Query found ${foundIds.length} additional vectors for this room`);
		} catch (error) {
			console.log(`[RAG] Could not query for additional vectors:`, error);
		}

		// Re-filter to get only valid IDs
		const idsToDelete = Array.from(allIds).filter(id => new TextEncoder().encode(id).length <= 64);
		console.log(`[RAG] Total vectors to delete for room ${this.roomId}: ${idsToDelete.length}`);

		// Step 3: Delete all vectors for this room
		if (idsToDelete.length > 0) {
			this.broadcastCleanupProgress('deleting', 50, `Deleting ${idsToDelete.length} vectors...`);
			
			let deleteSuccess = false;
			for (let attempt = 1; attempt <= 3; attempt++) {
				try {
					await this.env.VECTORIZE.deleteByIds(idsToDelete);
					console.log(`[RAG] ✓ Successfully deleted ${idsToDelete.length} vectors`);
					deleteSuccess = true;
					break;
				} catch (error) {
					console.error(`[RAG] Delete attempt ${attempt}/3 failed:`, error);
					if (attempt < 3) {
						await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
					}
				}
			}

			if (!deleteSuccess) {
				console.error('[RAG] Failed to delete vectors after 3 attempts');
			}
		} else {
			console.log(`[RAG] No vectors to delete for this room`);
		}

		// Step 4: Clear local storage
		this.broadcastCleanupProgress('verifying', 80, 'Clearing history...');
		await this.ctx.storage.delete(this.HISTORY_KEY);
		await this.ctx.storage.delete('all_vector_ids');
		
		// Also wait a brief moment for eventual consistency
		await new Promise(resolve => setTimeout(resolve, 500));
		
		this.broadcastCleanupProgress('complete', 100, 'Cleanup complete!');
		console.log(`[RAG] ✓ Complete cleanup finished for room: ${this.roomId}`);
	}

	/**
	 * Broadcasts cleanup progress to all connected clients
	 */
	private broadcastCleanupProgress(status: string, progress: number, message: string): void {
		const progressUpdate = JSON.stringify({
			type: 'cleanup_progress',
			status,
			progress,
			message,
		});

		for (const session of this.sessions) {
			try {
				session.webSocket.send(progressUpdate);
			} catch (error) {
				console.error('Error sending cleanup progress:', error);
			}
		}
	}

	/**
	 * Sends message history to a specific session
	 */
	private async sendHistory(session: Session): Promise<void> {
		const history = await this.getHistory();
		
		session.webSocket.send(
			JSON.stringify({
				type: 'history',
				messages: history,
			})
		);
	}

	/**
	 * Broadcasts a message to all connected sessions
	 * @param message The message to broadcast
	 * @param exclude Optional session to exclude from broadcast (e.g., the sender)
	 */
	private async broadcastMessage(message: ChatMessage, exclude?: Session): Promise<void> {
		const messageJson = JSON.stringify({
			type: 'message',
			message: message,
		});

		// Send to all sessions except the excluded one
		for (const session of this.sessions) {
			if (session !== exclude) {
				try {
					session.webSocket.send(messageJson);
				} catch (error) {
					// Remove session if send fails
					console.error('Error sending to session:', error);
					this.sessions.delete(session);
				}
			}
		}
	}

	/**
	 * Optional: Handle alarm for periodic cleanup or maintenance
	 */
	async alarm(): Promise<void> {
		// Can be used for periodic cleanup tasks if needed
		console.log('ChatRoom alarm triggered');
	}
}

