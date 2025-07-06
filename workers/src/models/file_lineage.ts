import type { Env, FileLineage } from '../types';
import { ApiError } from '../middleware/error';

// File relationships table schema (to be added to schema.sql)
// CREATE TABLE file_relationships (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   source_file_id TEXT NOT NULL,
//   target_file_id TEXT NOT NULL,
//   relationship_type TEXT NOT NULL, -- 'CUT_FROM', 'DERIVED_FROM', etc.
//   created_at TEXT NOT NULL,
//   FOREIGN KEY (source_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE,
//   FOREIGN KEY (target_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE
// );

export async function createFileRelationship(
  env: Env,
  sourceFileId: string,
  targetFileId: string,
  relationshipType: string
): Promise<void> {
  try {
    const createdAt = new Date().toISOString();
    
    await env.DB.prepare(`
      INSERT INTO file_relationships (source_file_id, target_file_id, relationship_type, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(sourceFileId, targetFileId, relationshipType, createdAt).run();
  } catch (error) {
    console.error('Create file relationship error:', error);
    throw new ApiError(500, 'Failed to create file relationship');
  }
}

export async function getFileLineage(
  env: Env,
  fileId: string,
  userId: string
): Promise<FileLineage> {
  try {
    // Get all relationships where this file is involved (as source or target)
    // and ensure user owns all files in the lineage
    const relationships = await env.DB.prepare(`
      SELECT DISTINCT 
        fr.source_file_id,
        fr.target_file_id,
        fr.relationship_type,
        sf1.file_name as source_name,
        sf2.file_name as target_name
      FROM file_relationships fr
      JOIN saved_files sf1 ON fr.source_file_id = sf1.file_id
      JOIN saved_files sf2 ON fr.target_file_id = sf2.file_id
      WHERE (fr.source_file_id = ? OR fr.target_file_id = ?)
        AND sf1.user_id = ? AND sf2.user_id = ?
    `).bind(fileId, fileId, userId, userId).all();

    // Build a set of all unique file IDs in the lineage
    const fileIds = new Set<string>();
    const edges: Array<{
      source: string;
      target: string;
      type: string;
    }> = [];

    fileIds.add(fileId);

    for (const rel of relationships.results) {
      const sourceId = rel.source_file_id as string;
      const targetId = rel.target_file_id as string;
      const relType = rel.relationship_type as string;

      fileIds.add(sourceId);
      fileIds.add(targetId);

      edges.push({
        source: sourceId,
        target: targetId,
        type: relType
      });
    }

    // Get detailed info for all files in the lineage
    if (fileIds.size === 0) {
      return { nodes: [], edges: [] };
    }

    const fileIdsList = Array.from(fileIds);
    const placeholders = fileIdsList.map(() => '?').join(',');
    
    const filesResult = await env.DB.prepare(`
      SELECT file_id, file_name
      FROM saved_files
      WHERE file_id IN (${placeholders}) AND user_id = ?
    `).bind(...fileIdsList, userId).all();

    const nodes = filesResult.results.map(file => ({
      file_id: file.file_id as string,
      file_name: file.file_name as string
    }));

    return { nodes, edges };
  } catch (error) {
    console.error('Get file lineage error:', error);
    throw new ApiError(500, 'Failed to retrieve file lineage');
  }
}

// Recursively find all ancestors and descendants of a file
export async function getCompleteLineage(
  env: Env,
  fileId: string,
  userId: string,
  visited = new Set<string>()
): Promise<FileLineage> {
  if (visited.has(fileId)) {
    return { nodes: [], edges: [] };
  }
  
  visited.add(fileId);
  
  try {
    // Get direct relationships
    const directLineage = await getFileLineage(env, fileId, userId);
    
    const allNodes = new Map<string, { file_id: string; file_name: string }>();
    const allEdges = [...directLineage.edges];
    
    // Add all nodes from direct lineage
    directLineage.nodes.forEach(node => {
      allNodes.set(node.file_id, node);
    });
    
    // Recursively get lineage for connected files
    for (const edge of directLineage.edges) {
      const nextFileId = edge.source === fileId ? edge.target : edge.source;
      
      if (!visited.has(nextFileId)) {
        const subLineage = await getCompleteLineage(env, nextFileId, userId, visited);
        
        // Merge nodes
        subLineage.nodes.forEach(node => {
          allNodes.set(node.file_id, node);
        });
        
        // Merge edges (avoid duplicates)
        subLineage.edges.forEach(subEdge => {
          const isDuplicate = allEdges.some(edge => 
            edge.source === subEdge.source && 
            edge.target === subEdge.target && 
            edge.type === subEdge.type
          );
          
          if (!isDuplicate) {
            allEdges.push(subEdge);
          }
        });
      }
    }
    
    return {
      nodes: Array.from(allNodes.values()),
      edges: allEdges
    };
  } catch (error) {
    console.error('Get complete lineage error:', error);
    throw new ApiError(500, 'Failed to retrieve complete file lineage');
  }
}