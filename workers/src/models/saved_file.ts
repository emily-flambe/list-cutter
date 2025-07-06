import type { Env, SavedFile, SavedFileCreate } from '../types';
import { ApiError } from '../middleware/error';

export async function createSavedFile(
  env: Env,
  data: SavedFileCreate
): Promise<SavedFile> {
  const { user_id, file_name, file_path, system_tags, metadata = {} } = data;
  
  const fileId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const systemTagsJson = JSON.stringify(system_tags);
  const userTagsJson = JSON.stringify([]);
  const metadataJson = JSON.stringify(metadata);

  try {
    await env.DB.prepare(`
      INSERT INTO saved_files (
        file_id, user_id, file_name, file_path, 
        uploaded_at, system_tags, user_tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      user_id,
      file_name,
      file_path,
      uploadedAt,
      systemTagsJson,
      userTagsJson,
      metadataJson
    ).run();

    return {
      file_id: fileId,
      user_id,
      file_name,
      file_path,
      uploaded_at: uploadedAt,
      system_tags,
      user_tags: [],
      metadata
    };
  } catch (error) {
    console.error('Create saved file error:', error);
    throw new ApiError(500, 'Failed to save file metadata');
  }
}

export async function getSavedFilesByUser(
  env: Env,
  userId: number
): Promise<SavedFile[]> {
  try {
    // Get distinct files by name, showing only the most recent upload
    const result = await env.DB.prepare(`
      SELECT DISTINCT ON (file_name) 
        file_id, user_id, file_name, file_path, uploaded_at, 
        system_tags, user_tags, metadata
      FROM saved_files
      WHERE user_id = ?
      ORDER BY file_name, uploaded_at DESC
    `).bind(userId).all();

    return result.results.map(row => ({
      file_id: row.file_id as string,
      user_id: row.user_id as number,
      file_name: row.file_name as string,
      file_path: row.file_path as string,
      uploaded_at: row.uploaded_at as string,
      system_tags: JSON.parse(row.system_tags as string || '[]'),
      user_tags: JSON.parse(row.user_tags as string || '[]'),
      metadata: JSON.parse(row.metadata as string || '{}')
    }));
  } catch (error) {
    console.error('Get saved files error:', error);
    throw new ApiError(500, 'Failed to retrieve saved files');
  }
}

export async function getSavedFileById(
  env: Env,
  fileId: string,
  userId: number
): Promise<SavedFile | null> {
  try {
    const result = await env.DB.prepare(`
      SELECT file_id, user_id, file_name, file_path, uploaded_at, 
             system_tags, user_tags, metadata
      FROM saved_files
      WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).first();

    if (!result) {
      return null;
    }

    return {
      file_id: result.file_id as string,
      user_id: result.user_id as number,
      file_name: result.file_name as string,
      file_path: result.file_path as string,
      uploaded_at: result.uploaded_at as string,
      system_tags: JSON.parse(result.system_tags as string || '[]'),
      user_tags: JSON.parse(result.user_tags as string || '[]'),
      metadata: JSON.parse(result.metadata as string || '{}')
    };
  } catch (error) {
    console.error('Get saved file by ID error:', error);
    throw new ApiError(500, 'Failed to retrieve saved file');
  }
}

export async function deleteSavedFile(
  env: Env,
  fileId: string,
  userId: number
): Promise<boolean> {
  try {
    const result = await env.DB.prepare(`
      DELETE FROM saved_files
      WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).run();

    const changes = (result as { changes?: number }).changes;
    return changes ? changes > 0 : false;
  } catch (error) {
    console.error('Delete saved file error:', error);
    throw new ApiError(500, 'Failed to delete saved file');
  }
}

export async function updateSavedFileTags(
  env: Env,
  fileId: string,
  userId: number,
  userTags: string[]
): Promise<SavedFile | null> {
  try {
    // First get the current file
    const currentFile = await getSavedFileById(env, fileId, userId);
    if (!currentFile) {
      return null;
    }

    // Merge new tags with existing tags (avoiding duplicates)
    const existingTags = currentFile.user_tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...userTags]));
    const userTagsJson = JSON.stringify(mergedTags);

    await env.DB.prepare(`
      UPDATE saved_files
      SET user_tags = ?
      WHERE file_id = ? AND user_id = ?
    `).bind(userTagsJson, fileId, userId).run();

    return {
      ...currentFile,
      user_tags: mergedTags
    };
  } catch (error) {
    console.error('Update saved file tags error:', error);
    throw new ApiError(500, 'Failed to update file tags');
  }
}