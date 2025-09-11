import api from '../api';

export class AssistantService {
  static async sendMessage(message, conversationId = null) {
    try {
      const response = await api.post('/api/v1/assistant/query', {
        query: message,
        conversation_id: conversationId
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Assistant service error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to send message'
      };
    }
  }

  static async getConversationHistory(conversationId) {
    try {
      const response = await api.get(`/api/v1/assistant/conversation/${conversationId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get conversation history error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to get conversation history'
      };
    }
  }

  static async clearConversation(conversationId) {
    try {
      const response = await api.delete(`/api/v1/assistant/conversation/${conversationId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Clear conversation error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to clear conversation'
      };
    }
  }

  static async getSuggestedActions(context = {}) {
    try {
      const response = await api.post('/api/v1/assistant/actions', {
        context
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Get suggested actions error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to get suggested actions'
      };
    }
  }
}

export default AssistantService;