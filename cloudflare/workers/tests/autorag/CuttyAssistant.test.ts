import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import { CuttyAssistant } from '../../src/autorag/CuttyAssistant';
import { AssistantQuery, Intent } from '../../src/autorag/types';

describe('CuttyAssistant', () => {
  let assistant: CuttyAssistant;
  let mockEnv: any;

  beforeAll(() => {
    mockEnv = {
      AI: {
        autorag: vi.fn().mockReturnValue({
          aiSearch: vi.fn(),
          search: vi.fn()
        })
      },
      AUTORAG_INSTANCE_NAME: 'cutty-assistant',
      AUTORAG_TIMEOUT_MS: 30000,
      AUTORAG_MAX_SOURCES: 5,
      AUTORAG_MIN_CONFIDENCE: 0.3,
      KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };
  });

  beforeEach(() => {
    assistant = new CuttyAssistant(mockEnv);
    vi.clearAllMocks();
  });

  describe('Intent Detection', () => {
    it('should detect documentation intent', async () => {
      const queries = [
        'How do I upload a file?',
        'What is Cuttytabs?',
        'Can I export to Excel?',
        'Where is the filter option?'
      ];
      
      for (const message of queries) {
        const query: AssistantQuery = { message, userId: 'test-user' };
        const intent = await assistant['detectIntent'](query);
        expect(intent.type).toBe(Intent.DOCUMENTATION);
        expect(intent.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect troubleshooting intent', async () => {
      const queries = [
        'Why is my upload failing?',
        'File upload error',
        'Cannot export data',
        'Login not working'
      ];
      
      for (const message of queries) {
        const query: AssistantQuery = { message, userId: 'test-user' };
        const intent = await assistant['detectIntent'](query);
        expect(intent.type).toBe(Intent.TROUBLESHOOTING);
        expect(intent.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect how-to intent', async () => {
      const queries = [
        'How to filter data?',
        'How can I create a pivot table?',
        'How do I generate synthetic data?'
      ];
      
      for (const message of queries) {
        const query: AssistantQuery = { message, userId: 'test-user' };
        const intent = await assistant['detectIntent'](query);
        expect(intent.type).toBe(Intent.HOW_TO);
        expect(intent.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect feature inquiry intent', async () => {
      const queries = [
        'What features are available?',
        'Can Cutty do cross-tabulation?',
        'Does it support Excel export?'
      ];
      
      for (const message of queries) {
        const query: AssistantQuery = { message, userId: 'test-user' };
        const intent = await assistant['detectIntent'](query);
        expect(intent.type).toBe(Intent.FEATURE_INQUIRY);
        expect(intent.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Query Handling', () => {
    it('should handle documentation queries', async () => {
      mockEnv.AI.autorag().aiSearch.mockResolvedValue({
        answer: 'To upload a file, click the Upload button...',
        sources: [
          {
            text: 'File upload guide',
            metadata: {
              filename: 'features/csv-processing/uploading-files.md',
              score: 0.92
            }
          }
        ],
        confidence: 0.9,
        rewrittenQuery: 'file upload process steps',
        tokensUsed: 150
      });

      const response = await assistant.handleQuery({
        message: 'How do I upload a file?',
        userId: 'test-user',
        sessionId: 'test-session'
      });

      expect(response.type).toBe('answer');
      expect(response.message).toContain('upload');
      expect(response.sources).toHaveLength(1);
      expect(response.confidence).toBeGreaterThan(0.8);
      expect(response.metadata?.tokensUsed).toBe(150);
    });

    it('should handle errors gracefully', async () => {
      mockEnv.AI.autorag().aiSearch.mockRejectedValue(
        new Error('AutoRAG service unavailable')
      );

      const response = await assistant.handleQuery({
        message: 'Test query',
        userId: 'test-user'
      });

      expect(response.type).toBe('error');
      expect(response.message).toContain('trouble answering');
      expect(response.confidence).toBe(0);
    });

    it('should timeout long-running queries', async () => {
      mockEnv.AUTORAG_TIMEOUT_MS = 100; // Short timeout for test
      assistant = new CuttyAssistant(mockEnv);

      mockEnv.AI.autorag().aiSearch.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 200))
      );

      const response = await assistant.handleQuery({
        message: 'Test query',
        userId: 'test-user'
      });

      expect(response.type).toBe('error');
      expect(response.message).toContain('taking longer than expected');
    });
  });

  describe('Source Processing', () => {
    it('should extract readable titles from filenames', () => {
      const testCases = [
        {
          input: 'features/csv-cutting/overview.md',
          expected: 'CSV Cutting Overview'
        },
        {
          input: 'getting-started/quick-start.md',
          expected: 'Quick Start'
        },
        {
          input: 'troubleshooting/upload-errors.md',
          expected: 'Upload Errors'
        }
      ];

      for (const testCase of testCases) {
        const title = assistant['extractTitle'](testCase.input);
        expect(title).toBe(testCase.expected);
      }
    });

    it('should truncate long text excerpts', () => {
      const longText = 'a'.repeat(200);
      const truncated = assistant['truncateText'](longText, 100);
      expect(truncated).toHaveLength(103); // 100 + '...'
      expect(truncated).toEndWith('...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      const result = assistant['truncateText'](shortText, 100);
      expect(result).toBe(shortText);
    });
  });

  describe('Action Suggestions', () => {
    it('should extract actions from answers mentioning upload', () => {
      const answer = 'To upload a file, go to the upload page and select your CSV file.';
      const actions = assistant['extractSuggestedActions'](answer);
      
      expect(actions).toContainEqual({
        type: 'navigate',
        label: 'Go to File Upload',
        data: { route: '/upload' },
        priority: 1
      });
    });

    it('should extract actions for CSV cutting mentions', () => {
      const answer = 'Use CSV cutting to filter your data and select specific columns.';
      const actions = assistant['extractSuggestedActions'](answer);
      
      expect(actions).toContainEqual({
        type: 'navigate',
        label: 'Open CSV Cutter',
        data: { route: '/csv-cutter' },
        priority: 1
      });
    });

    it('should extract actions for synthetic data mentions', () => {
      const answer = 'You can generate synthetic data for testing purposes.';
      const actions = assistant['extractSuggestedActions'](answer);
      
      expect(actions).toContainEqual({
        type: 'navigate',
        label: 'Generate Synthetic Data',
        data: { route: '/synthetic-data' },
        priority: 1
      });
    });
  });

  describe('Conversation Management', () => {
    it('should save conversation to KV store', async () => {
      mockEnv.AI.autorag().aiSearch.mockResolvedValue({
        answer: 'Test answer',
        sources: [],
        confidence: 0.8
      });

      await assistant.handleQuery({
        message: 'Test question',
        userId: 'test-user',
        sessionId: 'test-session',
        conversationId: 'test-conv'
      });

      expect(mockEnv.KV.put).toHaveBeenCalled();
      const callArgs = mockEnv.KV.put.mock.calls[0];
      expect(callArgs[0]).toContain('conversation:test-conv');
    });

    it('should retrieve conversation history', async () => {
      const mockHistory = {
        id: 'test-conv',
        userId: 'test-user',
        messages: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' }
        ]
      };

      mockEnv.KV.get.mockResolvedValue(JSON.stringify(mockHistory));

      const history = await assistant.getConversation('test-conv', 'test-user');
      expect(history).toEqual(mockHistory);
    });

    it('should clear conversation', async () => {
      await assistant.clearConversation('test-conv', 'test-user');
      
      expect(mockEnv.KV.delete).toHaveBeenCalledWith(
        expect.stringContaining('conversation:test-conv')
      );
    });
  });

  describe('Health Check', () => {
    it('should report healthy when AutoRAG is available', async () => {
      mockEnv.AI.autorag().aiSearch.mockResolvedValue({
        answer: 'Test',
        sources: [],
        confidence: 0.9
      });

      const health = await assistant.checkHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.checks.autorag).toBe('ok');
      expect(health.checks.kv).toBe('ok');
    });

    it('should report unhealthy when AutoRAG fails', async () => {
      mockEnv.AI.autorag().aiSearch.mockRejectedValue(
        new Error('Service unavailable')
      );

      const health = await assistant.checkHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.checks.autorag).toBe('error');
    });
  });

  describe('Metrics Recording', () => {
    it('should record query metrics', async () => {
      mockEnv.AI.autorag().aiSearch.mockResolvedValue({
        answer: 'Test answer',
        sources: [],
        confidence: 0.85,
        tokensUsed: 200
      });

      const consoleSpy = vi.spyOn(console, 'log');

      await assistant.handleQuery({
        message: 'Test query',
        userId: 'test-user'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Query metrics:',
        expect.objectContaining({
          userId: 'test-user',
          queryLength: 10,
          confidence: 0.85,
          sourcesCount: 0,
          tokensUsed: 200
        })
      );

      consoleSpy.mockRestore();
    });
  });
});