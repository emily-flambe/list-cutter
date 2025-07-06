#!/usr/bin/env python3
"""
export_neo4j_data.py
Export file relationships from Neo4j for List Cutter Phase 4 migration
"""

import os
import csv
import json
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional

def get_neo4j_config() -> Dict[str, str]:
    """Get Neo4j connection configuration from environment"""
    return {
        'uri': os.getenv('NEO4J_URI', 'bolt://localhost:7687'),
        'username': os.getenv('NEO4J_USERNAME', 'neo4j'),
        'password': os.getenv('NEO4J_PASSWORD', 'password'),
        'database': os.getenv('NEO4J_DATABASE', 'neo4j')
    }

def check_neo4j_connection(driver) -> bool:
    """Check if Neo4j connection is working"""
    try:
        with driver.session() as session:
            result = session.run("RETURN 1 as test")
            return result.single()['test'] == 1
    except Exception as e:
        print(f"Neo4j connection failed: {e}")
        return False

def get_node_count(driver) -> int:
    """Get total count of SavedFileNode records"""
    try:
        with driver.session() as session:
            result = session.run("MATCH (n:SavedFileNode) RETURN count(n) as count")
            return result.single()['count']
    except Exception as e:
        print(f"Error getting node count: {e}")
        return 0

def get_relationship_count(driver) -> int:
    """Get total count of CUT_FROM/CUT_TO relationships"""
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:SavedFileNode)-[r:CUT_FROM|CUT_TO]->(b:SavedFileNode) 
                RETURN count(r) as count
            """)
            return result.single()['count']
    except Exception as e:
        print(f"Error getting relationship count: {e}")
        return 0

def export_saved_file_nodes(driver, output_dir: str) -> int:
    """Export all SavedFileNode records to CSV"""
    print("Exporting SavedFileNode records...")
    
    filepath = os.path.join(output_dir, 'neo4j_nodes.csv')
    exported_count = 0
    
    try:
        with driver.session() as session:
            # Query all SavedFileNode records
            result = session.run("""
                MATCH (n:SavedFileNode)
                RETURN n.file_id as file_id,
                       n.file_name as file_name,
                       n.file_path as file_path,
                       n.metadata as metadata
                ORDER BY n.file_id
            """)
            
            with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['file_id', 'file_name', 'file_path', 'metadata']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for record in result:
                    # Convert metadata to JSON string if it exists
                    metadata = record['metadata']
                    if metadata is not None:
                        if isinstance(metadata, dict):
                            metadata = json.dumps(metadata, separators=(',', ':'))
                        elif not isinstance(metadata, str):
                            metadata = json.dumps(metadata, separators=(',', ':'))
                    else:
                        metadata = '{}'
                    
                    writer.writerow({
                        'file_id': record['file_id'] or '',
                        'file_name': record['file_name'] or '',
                        'file_path': record['file_path'] or '',
                        'metadata': metadata
                    })
                    exported_count += 1
                    
        print(f"✓ Exported {exported_count} SavedFileNode records")
        return exported_count
        
    except Exception as e:
        print(f"Error exporting nodes: {e}")
        return 0

def export_file_relationships(driver, output_dir: str) -> int:
    """Export all CUT_FROM/CUT_TO relationships to CSV"""
    print("Exporting file relationships...")
    
    filepath = os.path.join(output_dir, 'neo4j_relationships.csv')
    exported_count = 0
    
    try:
        with driver.session() as session:
            # Query all relationships
            result = session.run("""
                MATCH (source:SavedFileNode)-[r:CUT_FROM|CUT_TO]->(target:SavedFileNode)
                RETURN source.file_id as source_file_id,
                       target.file_id as target_file_id,
                       type(r) as relationship_type,
                       properties(r) as relationship_properties
                ORDER BY source.file_id, target.file_id
            """)
            
            with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['source_file_id', 'target_file_id', 'relationship_type', 'metadata']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for record in result:
                    # Convert relationship properties to JSON
                    metadata = record['relationship_properties'] or {}
                    if isinstance(metadata, dict):
                        metadata = json.dumps(metadata, separators=(',', ':'))
                    else:
                        metadata = '{}'
                    
                    writer.writerow({
                        'source_file_id': record['source_file_id'] or '',
                        'target_file_id': record['target_file_id'] or '',
                        'relationship_type': record['relationship_type'] or 'CUT_FROM',
                        'metadata': metadata
                    })
                    exported_count += 1
                    
        print(f"✓ Exported {exported_count} file relationships")
        return exported_count
        
    except Exception as e:
        print(f"Error exporting relationships: {e}")
        return 0

def create_export_summary(output_dir: str, nodes_count: int, relationships_count: int, config: Dict[str, str]):
    """Create a summary of the Neo4j export"""
    summary_path = os.path.join(output_dir, 'neo4j_export_summary.txt')
    
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write("List Cutter Neo4j Data Export Summary\n")
        f.write("=====================================\n\n")
        f.write(f"Export Date: {datetime.now().isoformat()}\n")
        f.write(f"Neo4j URI: {config['uri']}\n")
        f.write(f"Neo4j Database: {config['database']}\n")
        f.write(f"Export Directory: {output_dir}\n\n")
        f.write("Files Created:\n")
        f.write(f"- neo4j_nodes.csv ({nodes_count} SavedFileNode records)\n")
        f.write(f"- neo4j_relationships.csv ({relationships_count} relationship records)\n\n")
        f.write("Data Structure:\n")
        f.write("- Nodes represent file records with metadata\n")
        f.write("- Relationships show CUT_FROM/CUT_TO file lineage\n")
        f.write("- All metadata preserved as JSON strings\n\n")
        f.write("Next Steps:\n")
        f.write("1. Transform relationship data for D1 import\n")
        f.write("2. Validate exported data integrity\n")
        f.write("3. Import to D1 file_relationships table\n")
    
    print(f"✓ Export summary created: {summary_path}")

def main():
    """Main export function"""
    # Try to import neo4j driver
    try:
        from neo4j import GraphDatabase
    except ImportError:
        print("ERROR: neo4j driver not installed")
        print("Install with: pip install neo4j")
        sys.exit(1)
    
    # Get configuration
    config = get_neo4j_config()
    
    # Create output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"./neo4j_export_{timestamp}"
    os.makedirs(output_dir, exist_ok=True)
    
    print("=== List Cutter Neo4j Data Export ===")
    print(f"Neo4j URI: {config['uri']}")
    print(f"Database: {config['database']}")
    print(f"Output Directory: {output_dir}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("")
    
    # Connect to Neo4j
    try:
        driver = GraphDatabase.driver(
            config['uri'],
            auth=(config['username'], config['password'])
        )
        
        print("Checking Neo4j connection...")
        if not check_neo4j_connection(driver):
            print("ERROR: Cannot connect to Neo4j database")
            sys.exit(1)
        print("✓ Neo4j connection successful")
        
        # Get counts
        node_count = get_node_count(driver)
        relationship_count = get_relationship_count(driver)
        
        print(f"Found {node_count} SavedFileNode records")
        print(f"Found {relationship_count} file relationships")
        print("")
        
        if node_count == 0 and relationship_count == 0:
            print("WARNING: No data found in Neo4j database")
            print("This might be expected if no file relationships exist yet")
        
        # Export data
        print("Starting data export...")
        exported_nodes = export_saved_file_nodes(driver, output_dir)
        exported_relationships = export_file_relationships(driver, output_dir)
        
        # Create summary
        create_export_summary(output_dir, exported_nodes, exported_relationships, config)
        
        print("")
        print("=== Neo4j Export Complete ===")
        print(f"✓ Exported {exported_nodes} nodes")
        print(f"✓ Exported {exported_relationships} relationships")
        print(f"✓ Files created in: {output_dir}")
        print("")
        print("Files created:")
        for filename in os.listdir(output_dir):
            filepath = os.path.join(output_dir, filename)
            size = os.path.getsize(filepath)
            print(f"  {filename} ({size} bytes)")
        
        driver.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()