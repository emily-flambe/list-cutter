import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import ManageFiles from '../ManageFiles';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';

// Mock the API module
vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock the MUI icons to avoid import issues
vi.mock('@mui/icons-material/Download', () => ({
  default: () => <span>DownloadIcon</span>
}));

vi.mock('@mui/icons-material/Delete', () => ({
  default: () => <span>DeleteIcon</span>
}));

vi.mock('@mui/icons-material/CloudUpload', () => ({
  default: () => <span>CloudUploadIcon</span>
}));

vi.mock('@mui/icons-material/Description', () => ({
  default: () => <span>DescriptionIcon</span>
}));

describe('ManageFiles Component', () => {
  const mockToken = 'valid-token';
  const mockAuthContext = {
    token: mockToken,
    user: { id: 'user-1', username: 'testuser' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithAuth = (token = mockToken) => {
    return render(
      <AuthContext.Provider value={{ ...mockAuthContext, token }}>
        <ManageFiles />
      </AuthContext.Provider>
    );
  };

  describe('File List Display', () => {
    it('should display loading state initially', () => {
      api.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderWithAuth();
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display files when loaded successfully', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test-data.csv',
          size: 1024,
          mimeType: 'text/csv',
          createdAt: '2025-01-20T10:00:00Z',
          source: 'synthetic-data',
          status: 'completed'
        },
        {
          id: 'file-2',
          filename: 'uploaded-file.csv',
          size: 2048,
          mimeType: 'text/csv',
          createdAt: '2025-01-20T11:00:00Z',
          source: 'upload',
          status: 'completed'
        }
      ];

      api.get.mockResolvedValue({ data: { files: mockFiles } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
        expect(screen.getByText('uploaded-file.csv')).toBeInTheDocument();
      });

      // Check file metadata display
      expect(screen.getByText('1 KB')).toBeInTheDocument(); // 1024 bytes
      expect(screen.getByText('2 KB')).toBeInTheDocument(); // 2048 bytes
      expect(screen.getByText('Synthetic Data')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });

    it('should display empty state when no files exist', async () => {
      api.get.mockResolvedValue({ data: { files: [] } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('No files yet')).toBeInTheDocument();
        expect(screen.getByText('Your CSV files will appear here once you create them.')).toBeInTheDocument();
      });
    });

    it('should display error message when API fails', async () => {
      api.get.mockRejectedValue(new Error('Network error'));
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Failed to load your files. Please try again.')).toBeInTheDocument();
      });
    });

    it('should display login required message when not authenticated', () => {
      renderWithAuth(null);

      expect(screen.getByText('You must be logged in to view your files.')).toBeInTheDocument();
    });
  });

  describe('File Download', () => {
    const mockFiles = [{
      id: 'file-1',
      filename: 'test-data.csv',
      size: 1024,
      mimeType: 'text/csv',
      createdAt: '2025-01-20T10:00:00Z',
      source: 'synthetic-data',
      status: 'completed'
    }];

    beforeEach(async () => {
      api.get.mockResolvedValue({ data: { files: mockFiles } });
      
      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      // Mock document methods for download
      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn()
      };
      document.createElement = vi.fn(() => mockLink);
      document.body.appendChild = vi.fn();
    });

    it('should download file when download button is clicked', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      // Mock successful download
      api.get.mockResolvedValue({
        data: new Blob(['file content'], { type: 'text/csv' })
      });

      const downloadButton = screen.getAllByRole('button')[0]; // First icon button
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/v1/files/file-1', {
          headers: { Authorization: 'Bearer valid-token' },
          responseType: 'blob'
        });
        expect(screen.getByText('Successfully downloaded test-data.csv')).toBeInTheDocument();
      });
    });

    it('should handle download errors gracefully', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      api.get.mockRejectedValue({ response: { status: 404 } });

      const downloadButton = screen.getAllByRole('button')[0];
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('File not found. It may have been deleted.')).toBeInTheDocument();
      });
    });
  });

  describe('File Deletion', () => {
    const mockFiles = [{
      id: 'file-1',
      filename: 'test-data.csv',
      size: 1024,
      mimeType: 'text/csv',
      createdAt: '2025-01-20T10:00:00Z',
      source: 'synthetic-data',
      status: 'completed'
    }];

    it('should show confirmation dialog when delete button is clicked', async () => {
      api.get.mockResolvedValue({ data: { files: mockFiles } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button')[1]; // Second icon button
      fireEvent.click(deleteButton);

      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete "test-data.csv"? This action cannot be undone.')).toBeInTheDocument();
    });

    it('should delete file when confirmed', async () => {
      api.get.mockResolvedValue({ data: { files: mockFiles } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button')[1];
      fireEvent.click(deleteButton);

      api.delete.mockResolvedValue({ success: true });

      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/v1/files/file-1', {
          headers: { Authorization: 'Bearer valid-token' }
        });
        expect(screen.getByText('Successfully deleted test-data.csv')).toBeInTheDocument();
        expect(screen.queryByText('test-data.csv')).not.toBeInTheDocument();
      });
    });

    it('should cancel deletion when cancel is clicked', async () => {
      api.get.mockResolvedValue({ data: { files: mockFiles } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button')[1];
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
      expect(api.delete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      api.get.mockResolvedValue({ data: { files: mockFiles } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button')[1];
      fireEvent.click(deleteButton);

      api.delete.mockRejectedValue(new Error('Delete failed'));

      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to delete the file. Please try again.')).toBeInTheDocument();
        expect(screen.getByText('test-data.csv')).toBeInTheDocument(); // File still in list
      });
    });
  });

  describe('UI States', () => {
    it('should clear success messages after 5 seconds', async () => {
      const mockFiles = [{
        id: 'file-1',
        filename: 'test-data.csv',
        size: 1024,
        mimeType: 'text/csv',
        createdAt: '2025-01-20T10:00:00Z',
        source: 'synthetic-data',
        status: 'completed'
      }];

      api.get.mockResolvedValue({ data: { files: mockFiles } });
      vi.useFakeTimers();
      
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      // Trigger a delete to show success message
      const deleteButton = screen.getAllByRole('button')[1];
      fireEvent.click(deleteButton);
      
      api.delete.mockResolvedValue({ success: true });
      
      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Successfully deleted test-data.csv')).toBeInTheDocument();
      });

      // Fast forward 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText('Successfully deleted test-data.csv')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should show loading spinner during operations', async () => {
      const mockFiles = [{
        id: 'file-1',
        filename: 'test-data.csv',
        size: 1024,
        mimeType: 'text/csv',
        createdAt: '2025-01-20T10:00:00Z',
        source: 'synthetic-data',
        status: 'completed'
      }];

      api.get.mockResolvedValue({ data: { files: mockFiles } });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('test-data.csv')).toBeInTheDocument();
      });

      // Create a promise that doesn't resolve immediately
      let resolveDownload;
      api.get.mockImplementation(() => new Promise(resolve => {
        resolveDownload = resolve;
      }));

      const downloadButton = screen.getAllByRole('button')[0];
      fireEvent.click(downloadButton);

      // Should show spinner instead of icon
      await waitFor(() => {
        const button = screen.getAllByRole('button')[0];
        expect(within(button).getByRole('progressbar')).toBeInTheDocument();
      });

      // Resolve the download
      resolveDownload({ data: new Blob(['content']) });

      await waitFor(() => {
        const button = screen.getAllByRole('button')[0];
        expect(within(button).queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });
});