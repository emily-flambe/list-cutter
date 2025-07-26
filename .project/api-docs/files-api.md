# Files API Documentation

## Overview
The Files API provides secure file upload, management, and processing capabilities for authenticated users. Files are stored in Cloudflare R2 with metadata tracked in D1 database.

## Base URL
```
/api/v1/files
```

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Supported File Types
- **CSV**: `.csv` files
- **Text**: `.txt` files  
- **TSV**: `.tsv` files
- **Size Limit**: 50MB maximum

## Endpoints

### GET `/api/v1/files`
List all files for authenticated user with metadata.

**Response:**
```json
{
  "files": [
    {
      "id": "uuid",
      "filename": "data.csv",
      "size": 1024,
      "createdAt": "2024-01-01T00:00:00Z",
      "source": "upload" | "synthetic-data"
    }
  ]
}
```

### POST `/api/v1/files/upload`
Upload a new file.

**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData with `file` field

**Validation:**
- File type must be CSV, TXT, or TSV
- File size must be ≤ 50MB
- User must be authenticated

**Response:**
```json
{
  "success": true,
  "fileId": "uuid",
  "filename": "data.csv",
  "message": "File uploaded successfully"
}
```

### GET `/api/v1/files/:id`
Download a specific file.

**Parameters:**
- `id`: File UUID

**Response:**
- Content-Type: `application/octet-stream`
- Content-Disposition: `attachment; filename="original-filename.csv"`
- Body: File binary data

**Error Responses:**
- `404`: File not found or user doesn't have access
- `401`: Authentication required

### DELETE `/api/v1/files/:id`
Delete a specific file.

**Parameters:**
- `id`: File UUID

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Error Responses:**
- `404`: File not found or user doesn't have access
- `401`: Authentication required

## Frontend Integration

### File Upload Component
**Location**: `app/frontend/src/components/ManageFiles.jsx`

**Features:**
- Drag-and-drop upload interface
- File type validation
- Size limit enforcement
- Progress indicators
- Error handling with user feedback

### Authentication States

#### Logged-In Users
- Full file management interface
- Upload, list, download, delete operations
- File metadata display (size, date, source)
- Confirmation dialogs for destructive actions

#### Logged-Out Users
- Dramatic visual warning display
- Large flipped Cutty image with red glow animation
- "YOU ARE NOT LOGGED IN." message in Creepster font
- Login/Sign Up call-to-action buttons
- No access to file operations

### Navigation Integration
**Sidebar Behavior:**
- **Logged-out**: "Files" as direct link to `/manage_files` (shows warning)
- **Logged-in**: "Files (+)" as expandable group with Upload/Manage options

## Storage Architecture

### R2 Bucket Structure
```
cutty-files-dev/
├── users/
│   └── {userId}/
│       └── {fileId}_{originalname}
```

### D1 Database Schema
```sql
CREATE TABLE user_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content_type TEXT,
  source TEXT DEFAULT 'upload',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Security Considerations

### Access Control
- Files are scoped to individual users
- No cross-user file access
- JWT token validation required for all operations

### File Validation
- MIME type checking
- File extension validation
- Size limit enforcement
- Malicious file detection

### Storage Security
- R2 bucket access restricted to Workers
- No direct public access to files
- File paths include user isolation

## Error Handling

### Client-Side
- File type validation before upload
- Size checking with user feedback
- Network error retry logic
- Loading states during operations

### Server-Side
- Input validation with Zod schemas
- Database transaction rollback on failures
- R2 operation error handling
- Comprehensive error logging

## Performance Optimizations

### Upload Performance
- Streaming uploads to R2
- Progress tracking
- Chunked transfer encoding

### Download Performance
- Direct R2 streaming to client
- Proper cache headers
- Content-Disposition for downloads

### List Performance
- Efficient D1 queries with indexes
- Pagination for large file lists
- Metadata caching where appropriate

## Monitoring & Analytics

### Metrics Tracked
- File upload success/failure rates
- File size distributions
- User storage utilization
- Download frequencies

### Logging
- All file operations logged with user context
- Error events with stack traces
- Performance metrics for R2 operations

---
*API Version: v1.0.0 | Last Updated: Feature implementation*