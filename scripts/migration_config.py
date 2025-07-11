"""
Migration Configuration
=======================

Configuration settings for the file migration script.
"""

import os
from typing import Dict, Any

# Default configuration
DEFAULT_CONFIG = {
    # Batch processing settings
    'batch_size': 50,
    'max_retries': 3,
    'retry_delay_base': 2,  # Exponential backoff base (seconds)
    
    # API settings
    'api_timeout': 300,  # 5 minutes
    'api_base_url': os.getenv('WORKERS_API_URL', 'http://localhost:8787'),
    
    # Database settings
    'db_pool_min_size': 1,
    'db_pool_max_size': 20,
    'db_timeout': 30,
    
    # File processing settings
    'checksum_chunk_size': 4096,
    'max_file_size': 5 * 1024 * 1024 * 1024,  # 5GB
    
    # Logging settings
    'log_file': 'migration.log',
    'log_level': 'INFO',
    'log_format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    
    # Progress reporting
    'progress_update_interval': 10,  # seconds
    'progress_file': 'migration_progress.json',
    
    # Safety settings
    'dry_run_default': False,
    'require_confirmation': True,
    'backup_database': True,
}

def get_config() -> Dict[str, Any]:
    """Get migration configuration with environment overrides"""
    config = DEFAULT_CONFIG.copy()
    
    # Environment variable overrides
    env_overrides = {
        'MIGRATION_BATCH_SIZE': ('batch_size', int),
        'MIGRATION_MAX_RETRIES': ('max_retries', int),
        'MIGRATION_API_URL': ('api_base_url', str),
        'MIGRATION_API_TIMEOUT': ('api_timeout', int),
        'MIGRATION_LOG_LEVEL': ('log_level', str),
        'MIGRATION_DRY_RUN': ('dry_run_default', lambda x: x.lower() == 'true'),
    }
    
    for env_var, (config_key, type_converter) in env_overrides.items():
        env_value = os.getenv(env_var)
        if env_value:
            try:
                config[config_key] = type_converter(env_value)
            except (ValueError, TypeError) as e:
                print(f"Warning: Invalid value for {env_var}: {env_value} ({e})")
    
    return config

def validate_config(config: Dict[str, Any]) -> bool:
    """Validate migration configuration"""
    errors = []
    
    # Validate batch size
    if not isinstance(config['batch_size'], int) or config['batch_size'] < 1:
        errors.append("batch_size must be a positive integer")
    
    if config['batch_size'] > 1000:
        errors.append("batch_size should not exceed 1000 for performance reasons")
    
    # Validate retries
    if not isinstance(config['max_retries'], int) or config['max_retries'] < 0:
        errors.append("max_retries must be a non-negative integer")
    
    # Validate API URL
    if not config['api_base_url'] or not isinstance(config['api_base_url'], str):
        errors.append("api_base_url must be a valid URL string")
    
    # Validate timeouts
    if not isinstance(config['api_timeout'], int) or config['api_timeout'] < 1:
        errors.append("api_timeout must be a positive integer")
    
    if errors:
        print("Configuration validation errors:")
        for error in errors:
            print(f"  - {error}")
        return False
    
    return True

# Export configuration
MIGRATION_CONFIG = get_config()

if __name__ == '__main__':
    # Print current configuration
    print("Migration Configuration:")
    print("=" * 40)
    
    config = get_config()
    for key, value in sorted(config.items()):
        print(f"{key}: {value}")
    
    print("\nValidation:", "PASSED" if validate_config(config) else "FAILED")