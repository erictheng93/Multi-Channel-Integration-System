// Simplified Conversation Store - Split responsibilities for better maintainability
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Conversation, ConversationFilters } from '@/types'

// =================== Core Conversation List Store ===================
export const useConversationListStore = defineStore('conversationList', () => {
  const conversations = ref<Conversation[]>([])
  const filters = ref<ConversationFilters>({})

  // Simple reactive filtering
  const filteredConversations = computed(() => {
    if (!filters.value || Object.keys(filters.value).length === 0) {
      return conversations.value;
    }

    return conversations.value.filter(conversation => {
      if (filters.value.status && conversation.status !== filters.value.status) {return false;}
      if (filters.value.platform && conversation.platform !== filters.value.platform) {return false;}
      if (filters.value.assignedTo && conversation.assignedAgentId !== filters.value.assignedTo) {return false;}
      return true;
    });
  });

  const totalCount = computed(() => conversations.value.length);

  const setConversations = (newConversations: Conversation[]) => {
    conversations.value = newConversations;
  };

  const updateConversation = (updatedConversation: Conversation) => {
    const index = conversations.value.findIndex(c => c.id === updatedConversation.id);
    if (index !== -1) {
      conversations.value[index] = updatedConversation;
    }
  };

  const setFilters = (newFilters: ConversationFilters) => {
    filters.value = newFilters;
  };

  return {
    conversations: filteredConversations,
    totalCount,
    setConversations,
    updateConversation,
    setFilters
  };
});

// =================== Loading State Store ===================
export const useConversationLoadingStore = defineStore('conversationLoading', () => {
  const loading = ref(false);
  const refreshing = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);

  const isLoading = computed(() => loading.value || refreshing.value);

  const setLoading = (value: boolean) => { loading.value = value; };
  const setRefreshing = (value: boolean) => { refreshing.value = value; };
  const setLoadingMore = (value: boolean) => { loadingMore.value = value; };
  const setError = (errorMessage: string | null) => { error.value = errorMessage; };

  const clearError = () => { error.value = null; };

  return {
    loading,
    refreshing,
    loadingMore,
    error,
    isLoading,
    setLoading,
    setRefreshing,
    setLoadingMore,
    setError,
    clearError
  };
});

// =================== Message Operations Store ===================
export const useConversationMessagesStore = defineStore('conversationMessages', () => {
  const currentConversation = ref<Conversation | null>(null);
  const sendingMessage = ref(false);

  const setCurrentConversation = (conversation: Conversation | null) => {
    currentConversation.value = conversation;
  };

  const setSendingMessage = (value: boolean) => {
    sendingMessage.value = value;
  };

  return {
    currentConversation,
    sendingMessage,
    setCurrentConversation,
    setSendingMessage
  };
});

// =================== Main Composite Store ===================
export const useConversationsStore = defineStore('conversations', () => {
  const listStore = useConversationListStore();
  const loadingStore = useConversationLoadingStore();
  const messagesStore = useConversationMessagesStore();

  // Re-export simplified API for backward compatibility
  return {
    // State
    conversations: listStore.conversations,
    currentConversation: messagesStore.currentConversation,
    loading: loadingStore.loading,
    refreshing: loadingStore.refreshing,
    loadingMore: loadingStore.loadingMore,
    error: loadingStore.error,
    sendingMessage: messagesStore.sendingMessage,

    // Computed
    isLoading: loadingStore.isLoading,
    totalCount: listStore.totalCount,

    // Actions
    setConversations: listStore.setConversations,
    updateConversation: listStore.updateConversation,
    setFilters: listStore.setFilters,
    setCurrentConversation: messagesStore.setCurrentConversation,
    setLoading: loadingStore.setLoading,
    setRefreshing: loadingStore.setRefreshing,
    setLoadingMore: loadingStore.setLoadingMore,
    setError: loadingStore.setError,
    clearError: loadingStore.clearError,
    setSendingMessage: messagesStore.setSendingMessage
  };
});