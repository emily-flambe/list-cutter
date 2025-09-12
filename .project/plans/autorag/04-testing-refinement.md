# Phase 4: Testing & Refinement

## Objective
Validate the AutoRAG-powered assistant's response quality, performance, and user experience. Refine based on testing results to ensure production readiness.

## Testing Strategy

### 1. Unit Testing

#### Backend Tests (`tests/autorag/CuttyAssistant.test.ts`)
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { CuttyAssistant } from '../../src/autorag/CuttyAssistant';

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
      AUTORAG_INSTANCE_NAME: 'cutty-assistant'
    };
    assistant = new CuttyAssistant(mockEnv);
  });

  describe('Intent Detection', () => {
    it('should detect documentation intent', () => {
      const queries = [
        'How do I upload a file?',
        'What is Cuttytabs?',
        'Can I export to Excel?',
        'Where is the filter option?'
      ];
      
      queries.forEach(query => {
        const intent = assistant['detectIntent'](query);
        expect(intent).toBe('documentation');
      });
    });

    it('should detect action intent', () => {
      const queries = [
        'Generate synthetic data',
        'Create a new segment',
        'Upload my CSV file',
        'Export the results'
      ];
      
      queries.forEach(query => {
        const intent = assistant['detectIntent'](query);
        expect(intent).toBe('action');
      });
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
        confidence: 0.9
      });

      const response = await assistant.handleQuery({
        message: 'How do I upload a file?',
        sessionId: 'test-session'
      });

      expect(response.type).toBe('answer');
      expect(response.message).toContain('upload');
      expect(response.sources).toHaveLength(1);
      expect(response.confidence).toBeGreaterThan(0.8);
    });

    it('should handle errors gracefully', async () => {
      mockEnv.AI.autorag().aiSearch.mockRejectedValue(
        new Error('AutoRAG service unavailable')
      );

      const response = await assistant.handleQuery({
        message: 'Test query'
      });

      expect(response.type).toBe('error');
      expect(response.message).toContain('trouble');
    });
  });

  describe('Source Processing', () => {
    it('should extract readable titles from filenames', () => {
      const filename = 'features/csv-cutting/overview.md';
      const title = assistant['extractTitle'](filename);
      expect(title).toBe('Overview');
    });

    it('should truncate long text excerpts', () => {
      const longText = 'a'.repeat(200);
      const truncated = assistant['truncateText'](longText, 100);
      expect(truncated).toHaveLength(103); // 100 + '...'
      expect(truncated).toEndWith('...');
    });
  });

  describe('Action Suggestions', () => {
    it('should extract actions from answers', () => {
      const answer = 'To upload a file, go to the upload page and select your CSV file.';
      const actions = assistant['extractSuggestedActions'](answer);
      
      expect(actions).toContainEqual({
        type: 'navigate',
        label: 'Go to File Upload',
        data: { route: '/upload' }
      });
    });
  });
});
```

#### Frontend Tests (`tests/components/AssistantChat.test.jsx`)
```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AssistantChat from '../../src/components/Assistant/AssistantChat';
import { useAssistant } from '../../src/hooks/useAssistant';

vi.mock('../../src/hooks/useAssistant');

describe('AssistantChat', () => {
  const mockSendMessage = vi.fn();
  
  beforeEach(() => {
    useAssistant.mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: vi.fn()
    });
  });

  it('should render help button initially', () => {
    render(<AssistantChat />);
    expect(screen.getByLabelText('help')).toBeInTheDocument();
  });

  it('should open chat when help button clicked', () => {
    render(<AssistantChat />);
    const helpButton = screen.getByLabelText('help');
    fireEvent.click(helpButton);
    
    expect(screen.getByText('Cutty Assistant')).toBeInTheDocument();
  });

  it('should display welcome message when opened', () => {
    render(<AssistantChat />);
    fireEvent.click(screen.getByLabelText('help'));
    
    expect(screen.getByText(/Welcome to Cutty Assistant/)).toBeInTheDocument();
  });

  it('should send message when input submitted', async () => {
    render(<AssistantChat />);
    fireEvent.click(screen.getByLabelText('help'));
    
    const input = screen.getByPlaceholderText(/Ask me anything/);
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 13 });
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Test question');
    });
  });

  it('should display loading state', () => {
    useAssistant.mockReturnValue({
      messages: [],
      isLoading: true,
      error: null,
      sendMessage: mockSendMessage,
      clearMessages: vi.fn()
    });
    
    render(<AssistantChat />);
    fireEvent.click(screen.getByLabelText('help'));
    
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('should display error messages', () => {
    useAssistant.mockReturnValue({
      messages: [],
      isLoading: false,
      error: 'Connection failed',
      sendMessage: mockSendMessage,
      clearMessages: vi.fn()
    });
    
    render(<AssistantChat />);
    fireEvent.click(screen.getByLabelText('help'));
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });
});
```

### 2. Integration Testing

#### Test Scenarios
```javascript
// tests/integration/assistant-flow.test.js
describe('Assistant Integration Flow', () => {
  it('should handle complete documentation query flow', async () => {
    // 1. User opens assistant
    // 2. User asks question
    // 3. AutoRAG processes query
    // 4. Response displayed with sources
    // 5. User clicks suggested action
    // 6. Navigation occurs
  });

  it('should handle fallback when AutoRAG unavailable', async () => {
    // 1. AutoRAG service down
    // 2. User asks question
    // 3. Fallback response provided
    // 4. Error logged
    // 5. User notified appropriately
  });

  it('should maintain context across messages', async () => {
    // 1. User asks initial question
    // 2. User asks follow-up
    // 3. Context preserved
    // 4. Relevant response provided
  });
});
```

### 3. Performance Testing

#### Response Time Benchmarks
```javascript
// tests/performance/response-time.test.js
describe('Performance Benchmarks', () => {
  const queries = [
    'How do I upload a file?',
    'What are the file size limits?',
    'How can I filter my data?',
    'Can I export to Excel?',
    'What is Cuttytabs?'
  ];

  queries.forEach(query => {
    it(`should respond to "${query}" within 2 seconds`, async () => {
      const start = Date.now();
      const response = await assistant.handleQuery({ message: query });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(2000);
      expect(response.type).toBe('answer');
    });
  });
});
```

#### Load Testing
```javascript
// scripts/load-test.js
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  vus: 10, // 10 virtual users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
  }
};

export default function () {
  const queries = [
    'How do I upload a file?',
    'What is CSV cutting?',
    'How do I filter data?',
    'What are the limits?',
    'Can I export results?'
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const response = http.post(
    'https://cutty-dev.workers.dev/api/v1/assistant/chat',
    JSON.stringify({ message: query }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${__ENV.TEST_TOKEN}'
      }
    }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has answer': (r) => JSON.parse(r.body).message !== undefined,
    'response time < 2s': (r) => r.timings.duration < 2000
  });
}
```

### 4. Quality Testing

#### Query-Response Quality Matrix

| Query Category | Test Queries | Expected Quality |
|----------------|--------------|------------------|
| **How-to** | "How do I upload a CSV?", "How to filter data?" | Clear step-by-step instructions |
| **What-is** | "What is Cuttytabs?", "What are segments?" | Clear explanations with examples |
| **Troubleshooting** | "Why won't my file upload?", "Upload error" | Specific solutions, common causes |
| **Capabilities** | "Can I export to Excel?", "Do you support JSON?" | Yes/no with details |
| **Limits** | "File size limit?", "How many files?" | Specific numbers and constraints |

#### Quality Validation Script
```javascript
// scripts/quality-test.js
const qualityTests = [
  {
    category: 'How-to',
    queries: [
      'How do I upload a CSV file?',
      'How do I create a filter?',
      'How to export my data?'
    ],
    validation: (response) => {
      // Check for step-by-step structure
      const hasSteps = response.message.match(/\d\./g);
      const hasAction = response.suggestedActions?.length > 0;
      return hasSteps && hasAction;
    }
  },
  {
    category: 'What-is',
    queries: [
      'What is Cuttytabs?',
      'What is CSV cutting?',
      'What are segments?'
    ],
    validation: (response) => {
      // Check for definition and examples
      const hasDefinition = response.message.length > 100;
      const hasConfidence = response.confidence > 0.7;
      return hasDefinition && hasConfidence;
    }
  },
  {
    category: 'Limits',
    queries: [
      'What is the file size limit?',
      'How many files can I upload?',
      'Maximum number of columns?'
    ],
    validation: (response) => {
      // Check for specific numbers
      const hasNumbers = /\d+/.test(response.message);
      const hasUnits = /(MB|GB|files|columns)/.test(response.message);
      return hasNumbers && hasUnits;
    }
  }
];

async function runQualityTests() {
  const results = [];
  
  for (const test of qualityTests) {
    for (const query of test.queries) {
      const response = await sendQuery(query);
      const passed = test.validation(response);
      
      results.push({
        category: test.category,
        query,
        passed,
        confidence: response.confidence,
        sources: response.sources?.length || 0
      });
    }
  }
  
  // Generate report
  const passRate = results.filter(r => r.passed).length / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  console.log('Quality Test Results:');
  console.log(`Pass Rate: ${(passRate * 100).toFixed(1)}%`);
  console.log(`Average Confidence: ${avgConfidence.toFixed(2)}`);
  
  return results;
}
```

### 5. User Acceptance Testing

#### UAT Test Cases

```markdown
## Test Case 1: First-Time User Experience
1. Open application as new user
2. Notice help button
3. Click help button
4. Read welcome message
5. Ask "How do I get started?"
6. Verify helpful response with clear steps

## Test Case 2: File Upload Assistance
1. Navigate to upload page
2. Open assistant
3. Ask "How do I upload a CSV file?"
4. Verify response mentions current page context
5. Follow instructions provided
6. Confirm successful upload

## Test Case 3: Error Resolution
1. Encounter an error (e.g., file too large)
2. Ask assistant about the error
3. Verify assistant provides specific solution
4. Apply suggested fix
5. Confirm error resolved

## Test Case 4: Feature Discovery
1. Ask "What features are available?"
2. Verify comprehensive list provided
3. Click on suggested action
4. Navigate to feature successfully
5. Ask follow-up question about feature

## Test Case 5: Mobile Experience
1. Open on mobile device
2. Tap help button
3. Verify chat window fits screen
4. Type question using mobile keyboard
5. Verify response readable on mobile
6. Close and reopen chat
```

#### UAT Feedback Form
```javascript
const feedbackQuestions = [
  {
    question: "How helpful was the assistant?",
    type: "rating",
    scale: 1-5
  },
  {
    question: "Did you find the answers you needed?",
    type: "boolean"
  },
  {
    question: "How would you rate response speed?",
    type: "rating",
    scale: 1-5
  },
  {
    question: "Were the suggested actions useful?",
    type: "boolean"
  },
  {
    question: "What could be improved?",
    type: "text"
  }
];
```

### 6. Accessibility Testing

#### WCAG 2.1 Compliance Checklist
- [ ] Keyboard navigation works for all interactive elements
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] Screen reader announces all content correctly
- [ ] Color contrast meets AA standards (4.5:1 for normal text)
- [ ] Text is resizable up to 200% without loss of functionality
- [ ] No keyboard traps
- [ ] Error messages are clear and associated with inputs
- [ ] Time limits can be extended or disabled
- [ ] Content reflows for mobile viewports

#### Accessibility Test Script
```javascript
// tests/accessibility/wcag-compliance.test.js
import { axe } from '@axe-core/playwright';

describe('Accessibility Compliance', () => {
  it('should have no WCAG violations', async ({ page }) => {
    await page.goto('/');
    
    // Open assistant
    await page.click('[aria-label="help"]');
    
    // Run axe accessibility tests
    const results = await axe(page);
    
    expect(results.violations).toHaveLength(0);
  });

  it('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Tab to help button
    await page.keyboard.press('Tab');
    const helpButton = await page.locator('[aria-label="help"]');
    await expect(helpButton).toBeFocused();
    
    // Open with Enter
    await page.keyboard.press('Enter');
    
    // Tab to input
    await page.keyboard.press('Tab');
    const input = await page.locator('input[placeholder*="Ask me"]');
    await expect(input).toBeFocused();
  });

  it('should work with screen reader', async ({ page }) => {
    // Test with NVDA/JAWS simulation
    await page.goto('/');
    
    // Check ARIA labels
    const helpButton = await page.locator('[aria-label="help"]');
    await expect(helpButton).toHaveAttribute('role', 'button');
    
    // Check live regions for updates
    const messages = await page.locator('[aria-live="polite"]');
    await expect(messages).toBeVisible();
  });
});
```

### 7. Refinement Process

#### Feedback Analysis
```javascript
// scripts/analyze-feedback.js
async function analyzeFeedback() {
  const feedback = await collectFeedback();
  
  const analysis = {
    commonIssues: [],
    improvementAreas: [],
    positiveAspects: [],
    priorityFixes: []
  };
  
  // Categorize feedback
  feedback.forEach(item => {
    if (item.helpful < 3) {
      analysis.commonIssues.push(item.issue);
    }
    if (item.suggestion) {
      analysis.improvementAreas.push(item.suggestion);
    }
    if (item.helpful >= 4) {
      analysis.positiveAspects.push(item.aspect);
    }
  });
  
  // Identify priority fixes
  const issueCounts = {};
  analysis.commonIssues.forEach(issue => {
    issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  });
  
  analysis.priorityFixes = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count }));
  
  return analysis;
}
```

#### Documentation Improvements
Based on testing feedback, update documentation to:
1. Add missing information identified in queries
2. Clarify confusing sections
3. Add more examples
4. Improve search keywords
5. Add troubleshooting for common issues

#### Response Tuning
```javascript
// Adjust AutoRAG configuration based on testing
const refinedConfig = {
  retrieval: {
    maxResults: 5,  // Increased from 3
    minScore: 0.65, // Lowered from 0.7 for better recall
    diversityBias: 0.4 // Increased for more variety
  },
  generation: {
    temperature: 0.4, // Slightly increased for more natural responses
    maxTokens: 600,  // Increased for more detailed answers
    systemPrompt: `
      You are Cutty, a helpful assistant for the Cutty app.
      Rules:
      1. Always provide step-by-step instructions for how-to questions
      2. Include relevant page/button names in your answers
      3. Suggest next actions when appropriate
      4. Admit when you don't know something
      5. Keep answers concise but complete
    `
  }
};
```

## Success Metrics

### Quantitative Metrics
- **Response Accuracy**: >90% relevant responses
- **Response Time**: <2 seconds p95
- **User Satisfaction**: >4/5 average rating
- **Error Rate**: <5% of queries result in errors
- **Source Attribution**: >80% of answers include sources
- **Action Suggestions**: >60% include relevant actions

### Qualitative Metrics
- Users find answers helpful
- Reduced support ticket volume
- Positive user feedback
- Improved feature discovery
- Reduced time to task completion

## Testing Timeline

### Sprint 1: Foundation Testing
- Unit tests for all components
- Basic integration tests
- Initial performance benchmarks

### Sprint 2: Quality & UAT
- Quality validation testing
- User acceptance testing
- Accessibility compliance
- Feedback collection

### Sprint 3: Refinement
- Analyze feedback
- Update documentation
- Tune configurations
- Retest problem areas

### Sprint 4: Final Validation
- Complete regression testing
- Performance optimization
- Final UAT round
- Production readiness check

## Go/No-Go Criteria

### Must Pass
- [ ] All unit tests passing
- [ ] Response time <2s for 95% of queries
- [ ] No critical accessibility violations
- [ ] UAT satisfaction >80%
- [ ] Error rate <5%

### Should Pass
- [ ] Response accuracy >90%
- [ ] Source attribution >80%
- [ ] Mobile experience validated
- [ ] Load test successful

### Nice to Have
- [ ] Average confidence >0.8
- [ ] Cache hit rate >30%
- [ ] All suggested actions functional

## Next Steps

1. **If All Tests Pass**: Deploy to production
2. **If Minor Issues**: Fix and retest specific areas
3. **If Major Issues**: Return to Phase 3 for development fixes
4. **Continuous Improvement**: Monitor production metrics and iterate

---

*Phase Status: Ready for Testing*
*Estimated Testing Duration: 1-2 sprints*
*Dependencies: Completed integration from Phase 3*