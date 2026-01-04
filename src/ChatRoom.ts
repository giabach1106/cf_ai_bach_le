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

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Set();
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

		// Extract username from query parameters
		const url = new URL(request.url);
		const username = url.searchParams.get('username') || 'Anonymous';

		// Create WebSocket pair
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Accept the WebSocket connection
		server.accept();

		// Create session object
		const session: Session = {
			webSocket: server,
			username: username,
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

		// Notify other users about new connection
		const joinMessage: ChatMessage = {
			id: crypto.randomUUID(),
			username: 'System',
			content: `${username} joined the chat`,
			timestamp: Date.now(),
		};
		await this.broadcastMessage(joinMessage, session);

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

		// Create chat message
		const message: ChatMessage = {
			id: crypto.randomUUID(),
			username: session.username,
			content: data.content || '',
			timestamp: Date.now(),
		};

		// Store message in history
		await this.addMessageToHistory(message);

		// Broadcast to all connected sessions (excluding sender to avoid duplicates)
		await this.broadcastMessage(message, session);

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
	 * Generates text embedding using Workers AI
	 */
	private async generateEmbedding(text: string): Promise<number[]> {
		try {
			// Truncate text to prevent too large input (max ~512 tokens for BGE model)
			const truncatedText = text.substring(0, 1000);
			
			const response = await this.env.AI.run(
				'@cf/baai/bge-base-en-v1.5',
				{ text: [truncatedText] }
			) as { data: number[][] };
			
			if (!response?.data?.[0]) {
				throw new Error('Invalid embedding response');
			}
			
			return response.data[0];
		} catch (error) {
			console.error('[RAG] Error generating embedding:', error);
			throw error;
		}
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

			// RAG: Retrieve relevant context from Vectorize
			let contextString = '';
			let foundContextCount = 0;
			let debugInfo: string[] = [];
			
			try {
				debugInfo.push(`🔍 Generating embedding for: "${prompt.substring(0, 30)}..."`);
				
				// Generate embedding for the user's prompt
				const promptEmbedding = await this.generateEmbedding(prompt);
				console.log(`[RAG] Generated embedding for prompt: "${prompt.substring(0, 50)}..."`);
				debugInfo.push(`✓ Embedding generated (${promptEmbedding.length} dimensions)`);

				// Query Vectorize for top 5 most similar messages (increased from 3)
				debugInfo.push(`🔎 Querying Vectorize for similar messages...`);
				const searchResults = await this.env.VECTORIZE.query(promptEmbedding, {
					topK: 5,
					returnValues: false,
					returnMetadata: 'all',
				});

				console.log(`[RAG] Vectorize query returned ${searchResults.matches?.length || 0} matches`);
				debugInfo.push(`✓ Found ${searchResults.matches?.length || 0} potential matches`);

				// Extract context from matching vectors
				if (searchResults.matches && searchResults.matches.length > 0) {
					const contextMessages = searchResults.matches
						.filter((match) => match.score && match.score > 0.5) // Filter by similarity score
						.map((match) => {
							const content = match.metadata?.content as string;
							const username = match.metadata?.username as string;
							const score = match.score?.toFixed(3);
							console.log(`[RAG] Match (score: ${score}): ${username}: ${content?.substring(0, 50)}...`);
							debugInfo.push(`  📝 Match (${score}): ${username}: "${content?.substring(0, 40)}..."`);
							return `${username}: ${content}`;
						})
						.filter(Boolean);

					foundContextCount = contextMessages.length;

					if (contextMessages.length > 0) {
						contextString = '\n\nIMPORTANT - Relevant information from previous messages:\n' + 
							contextMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n') +
							'\n\nUse this information to answer the user\'s question.';
						debugInfo.push(`✅ Using ${foundContextCount} context messages for RAG`);
					} else {
						debugInfo.push(`⚠️ No matches above similarity threshold (0.5)`);
					}
				} else {
					debugInfo.push(`ℹ️ No matches found in Vectorize`);
				}

				console.log(`[RAG] Found ${foundContextCount} relevant context messages`);
			} catch (error) {
				console.error('Error retrieving context from Vectorize:', error);
				debugInfo.push(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
				// Continue without context if retrieval fails
			}

			// Send debug info to the requesting user (only if needed for debugging)
			// Set to true to enable RAG debug messages in chat
			const ENABLE_RAG_DEBUG = false;
			
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

			// Build system message with optional context
			const systemMessage = 'You are a helpful AI assistant in a chat room. Be concise and friendly. ' +
				'If relevant context from previous conversations is provided, USE IT to answer accurately. ' +
				'Pay special attention to user preferences, names, and facts mentioned in the context.' + 
				contextString;

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
	 */
	private async storeMessageEmbedding(message: ChatMessage): Promise<void> {
		try {
			// Strip @ai prefix if present (we want to store the actual content, not the command)
			const contentToStore = message.content.trim().startsWith('@ai')
				? message.content.trim().substring(3).trim()
				: message.content;
			
			console.log(`[RAG] Storing message in Vectorize: ${message.username}: "${contentToStore.substring(0, 50)}..."`);
			
			// Generate embedding for the message content
			const embedding = await this.generateEmbedding(contentToStore);
			console.log(`[RAG] Generated embedding with ${embedding.length} dimensions`);

			// Insert into Vectorize with message content as metadata
			const result = await this.env.VECTORIZE.upsert([
				{
					id: message.id,
					values: embedding,
					metadata: {
						content: contentToStore,
						username: message.username,
						timestamp: message.timestamp,
					},
				},
			]);
			
			console.log(`[RAG] Successfully stored message with ID: ${message.id}`);
			
			// Optional: Send confirmation to all users (commented out for production)
			// Uncomment below to debug RAG storage
			/*
			const debugMsg = `💾 Stored in RAG: "${contentToStore.substring(0, 40)}..." (${embedding.length}D)`;
			for (const session of this.sessions) {
				try {
					session.webSocket.send(
						JSON.stringify({
							type: 'rag_debug',
							info: debugMsg,
						})
					);
				} catch (e) {
					// Ignore send errors
				}
			}
			*/
		} catch (error) {
			console.error('[RAG] Failed to store embedding:', error);
			throw error;
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
	 * Clears all message history from storage
	 */
	private async clearHistory(): Promise<void> {
		// Get all message IDs before clearing
		const history = await this.getHistory();
		const vectorIds = history.map((msg) => msg.id);

		// Clear message history from storage
		await this.ctx.storage.delete(this.HISTORY_KEY);

		// Delete all vectors from Vectorize index
		if (vectorIds.length > 0) {
			try {
				await this.env.VECTORIZE.deleteByIds(vectorIds);
			} catch (error) {
				console.error('Error deleting vectors from Vectorize:', error);
				// Don't throw - history is already cleared from storage
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

