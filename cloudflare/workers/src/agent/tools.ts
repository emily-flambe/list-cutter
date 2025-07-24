import { tool } from 'agents';
import { z } from 'zod';

// Tool definitions for CuttyAgent

export const generateSyntheticDataTool = tool({
  description: 'Generate synthetic voter registration data with realistic information',
  parameters: z.object({
    count: z.number().min(1).max(1000).describe('Number of records to generate (1-1000)'),
    states: z.array(z.string()).optional().describe('List of state codes to filter by (e.g., ["CA", "TX", "FL"])'),
    format: z.enum(['csv', 'json']).default('csv').describe('Output format for the data'),
  }),
});

export const getSupportedStatesTool = tool({
  description: 'Get the list of US states supported for synthetic data generation',
  parameters: z.object({}),
});

export const createListTool = tool({
  description: 'Create a new list for organizing data',
  parameters: z.object({
    name: z.string().min(1).max(100).describe('Name of the list'),
    description: z.string().max(500).optional().describe('Optional description of the list'),
  }),
});

export const uploadFileTool = tool({
  description: 'Process and upload a CSV file to a list',
  parameters: z.object({
    fileUrl: z.string().url().describe('URL of the file to upload'),
    listId: z.string().describe('ID of the list to add the file to'),
    processOptions: z.object({
      skipDuplicates: z.boolean().default(true).describe('Skip duplicate entries'),
      validateData: z.boolean().default(true).describe('Validate data format'),
    }).optional(),
  }),
});

export const searchListsTool = tool({
  description: 'Search for lists by name or content',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
  }),
});

// Tool execution handlers (to be implemented in CuttyAgent)
export const toolExecutions = {
  generateSyntheticData: async (params: any, context: any) => {
    // Implementation will be in CuttyAgent class
    throw new Error('Not implemented - use CuttyAgent class');
  },
  getSupportedStates: async (params: any, context: any) => {
    // Implementation will be in CuttyAgent class
    throw new Error('Not implemented - use CuttyAgent class');
  },
  createList: async (params: any, context: any) => {
    // This tool requires confirmation - handled by frontend
    return { requiresConfirmation: true, params };
  },
  uploadFile: async (params: any, context: any) => {
    // This tool requires confirmation - handled by frontend
    return { requiresConfirmation: true, params };
  },
  searchLists: async (params: any, context: any) => {
    // Implementation will be in CuttyAgent class
    throw new Error('Not implemented - use CuttyAgent class');
  },
};

// Helper function to get all tools
export function getAllTools() {
  return {
    generateSyntheticData: generateSyntheticDataTool,
    getSupportedStates: getSupportedStatesTool,
    createList: createListTool,
    uploadFile: uploadFileTool,
    searchLists: searchListsTool,
  };
}

// Tools that require user confirmation before execution
export const toolsRequiringConfirmation = ['createList', 'uploadFile'];