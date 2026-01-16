# Sed script to replace all sseMessages and conversationWS references with unified connection

# Template references (v-if, v-bind, etc.)
s/sseMessages\.isConnected\.value/unifiedIsConnected.value/g
s/sseMessages\.hasError\.value/unifiedConnectionState.value === 'error'/g
s/sseMessages\.isConnecting\.value/unifiedConnectionState.value === 'connecting'/g
s/sseMessages\.isReconnecting\.value/unifiedConnectionState.value === 'reconnecting'/g
s/sseMessages\.messageCount\.value/unifiedConnection.value ? unifiedConnection.value.messageCount.value : 0/g
s/sseMessages\.messages\.value/unifiedConnection.value ? unifiedConnection.value.messages.value : []/g
s/sseMessages\.connectionState\.value\.reconnectAttempts/0/g
s/sseMessages\.connectionState\.value\.error/unifiedConnectionState.value === 'error' ? 'Connection error' : ''/g
s/sseMessages\.canReconnect\.value/true/g

# Script method calls
s/sseMessages\.reconnect()/unifiedConnection.value?.reconnect()/g
s/sseMessages\.clearNewMessageCount()/\/\/ Unified connection handles this automatically/g
s/await sseMessages\.reconnect()/if (unifiedConnection.value) { unifiedConnection.value.reconnect() }/g

# WebSocket references - remove or comment out
s/conversationWS\.isJoined\.value/false/g
s/conversationWS\.sendMessage/\/\/ WebSocket not available - /g
s/conversationWS\.refreshMessages/\/\/ WebSocket not available - /g
s/conversationWS\.messages\.value/[]/g
s/conversationWS\.hasNewMessages\.value/false/g
s/conversationWS\.newMessagesCount\.value/0/g
s/conversationWS\.presence\.value/{ isOnline: false, typingUsers: [] }/g
s/conversationWS\.loading\.value/false/g

# isWebSocketJoined computed
s/isWebSocketEnabled\.value && conversationWS\.isJoined\.value/false/g
