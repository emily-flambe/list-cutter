import {
  ThreatIntelligenceDatabase,
  ThreatSignature,
  PIIPattern,
  MalwareHash,
  SuspiciousIP,
  ThreatType,
  ThreatSeverity,
  PIIType,
  PIISeverity,
  ThreatIntelligenceUpdateResponse
} from '../../types/threat-intelligence';

/**
 * Threat Intelligence Database Service
 * Manages threat intelligence data, updates, and integration with external sources
 */
export class ThreatIntelligenceDatabaseService {
  private db: D1Database;
  private cache: Map<string, unknown> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Initialize threat intelligence database with default data
   */
  async initializeDatabase(): Promise<void> {
    try {
      // Create tables if they don't exist
      await this.createTables();

      // Load default threat signatures
      await this.loadDefaultSignatures();

      // Load default PII patterns
      await this.loadDefaultPIIPatterns();

      // Load default malware hashes
      await this.loadDefaultMalwareHashes();

      // Threat intelligence database initialized successfully
    } catch (error) {
      console.error('Failed to initialize threat intelligence database:', error);
      throw error;
    }
  }

  /**
   * Create necessary database tables
   */
  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS threat_signatures (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        last_updated TEXT NOT NULL,
        source TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE
      )`,
      
      `CREATE TABLE IF NOT EXISTS pii_patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL,
        locale TEXT,
        validation TEXT,
        examples TEXT,
        false_positives TEXT,
        enabled BOOLEAN DEFAULT TRUE
      )`,
      
      `CREATE TABLE IF NOT EXISTS malware_hashes (
        hash TEXT PRIMARY KEY,
        hash_type TEXT NOT NULL,
        malware_family TEXT,
        threat_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        source TEXT NOT NULL,
        description TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS suspicious_ips (
        ip TEXT PRIMARY KEY,
        threat_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        source TEXT NOT NULL,
        description TEXT,
        confidence INTEGER NOT NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS threat_intelligence_updates (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        signatures_count INTEGER NOT NULL,
        patterns_count INTEGER NOT NULL,
        hashes_count INTEGER NOT NULL,
        ips_count INTEGER NOT NULL,
        last_updated TEXT NOT NULL,
        source TEXT NOT NULL
      )`
    ];

    for (const table of tables) {
      await this.db.prepare(table).run();
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_threat_signatures_type ON threat_signatures(type)',
      'CREATE INDEX IF NOT EXISTS idx_threat_signatures_severity ON threat_signatures(severity)',
      'CREATE INDEX IF NOT EXISTS idx_pii_patterns_type ON pii_patterns(type)',
      'CREATE INDEX IF NOT EXISTS idx_malware_hashes_type ON malware_hashes(hash_type)',
      'CREATE INDEX IF NOT EXISTS idx_suspicious_ips_severity ON suspicious_ips(severity)'
    ];

    for (const index of indexes) {
      await this.db.prepare(index).run();
    }
  }

  /**
   * Load default threat signatures
   */
  private async loadDefaultSignatures(): Promise<void> {
    const defaultSignatures: ThreatSignature[] = [
      {
        id: 'sig_001',
        name: 'JavaScript Obfuscation Advanced',
        type: ThreatType.OBFUSCATED_CODE,
        pattern: '(eval\\s*\\(\\s*["\'].*["\']\\s*\\)|Function\\s*\\(\\s*["\'].*["\']\\s*\\)|\\[\\s*["\']constructor["\']\\s*\\])',
        description: 'Advanced JavaScript obfuscation patterns',
        severity: ThreatSeverity.HIGH,
        confidence: 90,
        lastUpdated: new Date(),
        source: 'internal_research'
      },
      {
        id: 'sig_002',
        name: 'PowerShell Encoded Payload',
        type: ThreatType.MALWARE,
        pattern: 'powershell.*-enc.*[A-Za-z0-9+/=]{50,}',
        description: 'PowerShell with encoded payload',
        severity: ThreatSeverity.CRITICAL,
        confidence: 95,
        lastUpdated: new Date(),
        source: 'internal_research'
      },
      {
        id: 'sig_003',
        name: 'SQL Injection Pattern',
        type: ThreatType.SUSPICIOUS_PATTERN,
        pattern: '(union.*select|select.*from.*where|insert.*into.*values|update.*set.*where|delete.*from.*where)',
        description: 'Common SQL injection patterns',
        severity: ThreatSeverity.HIGH,
        confidence: 85,
        lastUpdated: new Date(),
        source: 'internal_research'
      },
      {
        id: 'sig_004',
        name: 'XSS Script Pattern',
        type: ThreatType.PHISHING,
        pattern: '<script[^>]*>.*?(alert\\s*\\(|document\\.cookie|window\\.location).*?</script>',
        description: 'Cross-site scripting patterns',
        severity: ThreatSeverity.HIGH,
        confidence: 88,
        lastUpdated: new Date(),
        source: 'internal_research'
      },
      {
        id: 'sig_005',
        name: 'Cryptocurrency Mining',
        type: ThreatType.MALWARE,
        pattern: '(coinhive|cryptonight|monero|bitcoin.*mining|mining.*pool)',
        description: 'Cryptocurrency mining indicators',
        severity: ThreatSeverity.MEDIUM,
        confidence: 80,
        lastUpdated: new Date(),
        source: 'internal_research'
      }
    ];

    for (const signature of defaultSignatures) {
      await this.upsertThreatSignature(signature);
    }
  }

  /**
   * Load default PII patterns
   */
  private async loadDefaultPIIPatterns(): Promise<void> {
    const defaultPatterns: PIIPattern[] = [
      {
        id: 'pii_001',
        type: PIIType.SSN,
        pattern: '\\b(?!000|666|9[0-9]{2})[0-9]{3}-?(?!00)[0-9]{2}-?(?!0000)[0-9]{4}\\b',
        description: 'US Social Security Number',
        severity: PIISeverity.CRITICAL,
        locale: 'US',
        examples: ['123-45-6789', '123456789'],
        falsePositives: ['000-00-0000', '123-00-0000']
      },
      {
        id: 'pii_002',
        type: PIIType.CREDIT_CARD,
        pattern: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b',
        description: 'Credit card numbers (Visa, MC, Amex, Discover)',
        severity: PIISeverity.CRITICAL,
        examples: ['4111111111111111', '5555555555554444'],
        falsePositives: ['0000000000000000']
      },
      {
        id: 'pii_003',
        type: PIIType.PHONE_NUMBER,
        pattern: '\\b(?:\\+?1[-\\s]?)?\\(?([0-9]{3})\\)?[-\\s]?([0-9]{3})[-\\s]?([0-9]{4})\\b',
        description: 'US phone numbers',
        severity: PIISeverity.MEDIUM,
        locale: 'US',
        examples: ['(555) 123-4567', '+1-555-123-4567'],
        falsePositives: ['000-000-0000']
      },
      {
        id: 'pii_004',
        type: PIIType.EMAIL,
        pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
        description: 'Email addresses',
        severity: PIISeverity.MEDIUM,
        examples: ['user@example.com'],
        falsePositives: ['test@test.com', 'example@example.com']
      },
      {
        id: 'pii_005',
        type: PIIType.BANK_ACCOUNT,
        pattern: '\\b[0-9]{8,17}\\b',
        description: 'Bank account numbers',
        severity: PIISeverity.CRITICAL,
        examples: ['123456789012'],
        falsePositives: ['00000000', '11111111']
      }
    ];

    for (const pattern of defaultPatterns) {
      await this.upsertPIIPattern(pattern);
    }
  }

  /**
   * Load default malware hashes
   */
  private async loadDefaultMalwareHashes(): Promise<void> {
    const defaultHashes: MalwareHash[] = [
      {
        hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
        hashType: 'sha256',
        malwareFamily: 'example_malware',
        threatType: ThreatType.MALWARE,
        severity: ThreatSeverity.HIGH,
        firstSeen: new Date('2024-01-01'),
        lastSeen: new Date(),
        source: 'internal_research',
        description: 'Example malware hash for testing'
      }
    ];

    for (const hash of defaultHashes) {
      await this.upsertMalwareHash(hash);
    }
  }

  /**
   * Get all threat signatures
   */
  async getThreatSignatures(enabledOnly: boolean = true): Promise<ThreatSignature[]> {
    const cacheKey = `signatures_${enabledOnly}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const query = enabledOnly 
      ? 'SELECT * FROM threat_signatures WHERE enabled = TRUE ORDER BY severity DESC'
      : 'SELECT * FROM threat_signatures ORDER BY severity DESC';

    const results = await this.db.prepare(query).all();
    
    const signatures = results.results.map(row => this.mapToThreatSignature(row));
    this.setCache(cacheKey, signatures);
    
    return signatures;
  }

  /**
   * Get PII patterns
   */
  async getPIIPatterns(enabledOnly: boolean = true): Promise<PIIPattern[]> {
    const cacheKey = `pii_patterns_${enabledOnly}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const query = enabledOnly 
      ? 'SELECT * FROM pii_patterns WHERE enabled = TRUE ORDER BY severity DESC'
      : 'SELECT * FROM pii_patterns ORDER BY severity DESC';

    const results = await this.db.prepare(query).all();
    
    const patterns = results.results.map(row => this.mapToPIIPattern(row));
    this.setCache(cacheKey, patterns);
    
    return patterns;
  }

  /**
   * Get malware hashes
   */
  async getMalwareHashes(): Promise<MalwareHash[]> {
    const cached = this.getFromCache('malware_hashes');
    if (cached) return cached;

    const results = await this.db.prepare('SELECT * FROM malware_hashes ORDER BY last_seen DESC').all();
    
    const hashes = results.results.map(row => this.mapToMalwareHash(row));
    this.setCache('malware_hashes', hashes);
    
    return hashes;
  }

  /**
   * Get suspicious IPs
   */
  async getSuspiciousIPs(): Promise<SuspiciousIP[]> {
    const cached = this.getFromCache('suspicious_ips');
    if (cached) return cached;

    const results = await this.db.prepare('SELECT * FROM suspicious_ips ORDER BY last_seen DESC').all();
    
    const ips = results.results.map(row => this.mapToSuspiciousIP(row));
    this.setCache('suspicious_ips', ips);
    
    return ips;
  }

  /**
   * Get complete threat intelligence database
   */
  async getThreatIntelligenceDatabase(): Promise<ThreatIntelligenceDatabase> {
    const [signatures, piiPatterns, malwareHashes, suspiciousIPs] = await Promise.all([
      this.getThreatSignatures(),
      this.getPIIPatterns(),
      this.getMalwareHashes(),
      this.getSuspiciousIPs()
    ]);

    // Get latest update info
    const updateInfo = await this.db.prepare(
      'SELECT * FROM threat_intelligence_updates ORDER BY last_updated DESC LIMIT 1'
    ).first();

    return {
      signatures,
      piiPatterns,
      malwareHashes,
      suspiciousIPs,
      lastUpdated: updateInfo ? new Date(updateInfo.last_updated as string) : new Date(),
      version: updateInfo?.version as string || '1.0.0',
      source: updateInfo?.source as string || 'internal'
    };
  }

  /**
   * Update threat intelligence from external source
   */
  async updateFromExternalSource(
    sourceUrl: string,
    _sourceType: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<ThreatIntelligenceUpdateResponse> {
    try {
      // In a real implementation, this would fetch from external threat intelligence feeds
      // For now, we'll simulate an update
      
      const updateId = crypto.randomUUID();
      const timestamp = new Date();
      
      // Simulate updating threat signatures
      const newSignatures = await this.simulateExternalSignatures();
      let updatedSignatures = 0;
      
      for (const signature of newSignatures) {
        await this.upsertThreatSignature(signature);
        updatedSignatures++;
      }

      // Clear cache to force refresh
      this.clearCache();

      // Record update
      await this.db.prepare(`
        INSERT INTO threat_intelligence_updates 
        (id, version, signatures_count, patterns_count, hashes_count, ips_count, last_updated, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        updateId,
        '1.0.1',
        updatedSignatures,
        0,
        0,
        0,
        timestamp.toISOString(),
        sourceUrl
      ).run();

      return {
        success: true,
        updatedSignatures,
        updatedPatterns: 0,
        updatedHashes: 0,
        version: '1.0.1',
        timestamp,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        updatedSignatures: 0,
        updatedPatterns: 0,
        updatedHashes: 0,
        version: '',
        timestamp: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Upsert threat signature
   */
  async upsertThreatSignature(signature: ThreatSignature): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO threat_signatures 
      (id, name, type, pattern, description, severity, confidence, last_updated, source, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      signature.id,
      signature.name,
      signature.type,
      signature.pattern,
      signature.description,
      signature.severity,
      signature.confidence,
      signature.lastUpdated.toISOString(),
      signature.source,
      true
    ).run();

    this.clearCache('signatures');
  }

  /**
   * Upsert PII pattern
   */
  async upsertPIIPattern(pattern: PIIPattern): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO pii_patterns 
      (id, type, pattern, description, severity, locale, validation, examples, false_positives, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pattern.id,
      pattern.type,
      pattern.pattern,
      pattern.description,
      pattern.severity,
      pattern.locale,
      pattern.validation,
      JSON.stringify(pattern.examples),
      JSON.stringify(pattern.falsePositives),
      true
    ).run();

    this.clearCache('pii');
  }

  /**
   * Upsert malware hash
   */
  async upsertMalwareHash(hash: MalwareHash): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO malware_hashes 
      (hash, hash_type, malware_family, threat_type, severity, first_seen, last_seen, source, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      hash.hash,
      hash.hashType,
      hash.malwareFamily,
      hash.threatType,
      hash.severity,
      hash.firstSeen.toISOString(),
      hash.lastSeen.toISOString(),
      hash.source,
      hash.description
    ).run();

    this.clearCache('malware');
  }

  /**
   * Simulate external threat signatures (for demo purposes)
   */
  private async simulateExternalSignatures(): Promise<ThreatSignature[]> {
    return [
      {
        id: 'ext_001',
        name: 'Advanced Persistent Threat Pattern',
        type: ThreatType.MALWARE,
        pattern: '(persistence|lateral.*movement|privilege.*escalation)',
        description: 'APT behavior indicators',
        severity: ThreatSeverity.CRITICAL,
        confidence: 95,
        lastUpdated: new Date(),
        source: 'external_feed'
      },
      {
        id: 'ext_002',
        name: 'Ransomware File Extension',
        type: ThreatType.RANSOMWARE,
        pattern: '\\.(locked|encrypted|crypted|crypt|enc)$',
        description: 'Common ransomware file extensions',
        severity: ThreatSeverity.CRITICAL,
        confidence: 90,
        lastUpdated: new Date(),
        source: 'external_feed'
      }
    ];
  }

  /**
   * Map database row to ThreatSignature
   */
  private mapToThreatSignature(row: {
    id: string;
    name: string;
    type: string;
    pattern: string;
    description: string;
    severity: string;
    confidence_score: number;
    created_at: string;
    last_updated: string;
    source: string;
    tags?: string;
    metadata?: string;
    is_active: number;
  }): ThreatSignature {
    return {
      id: row.id,
      name: row.name,
      type: row.type as ThreatType,
      pattern: row.pattern,
      description: row.description,
      severity: row.severity as ThreatSeverity,
      confidence: row.confidence,
      lastUpdated: new Date(row.last_updated),
      source: row.source
    };
  }

  /**
   * Map database row to PIIPattern
   */
  private mapToPIIPattern(row: {
    id: string;
    type: string;
    pattern: string;
    description: string;
    severity: string;
    regex_pattern: string;
    test_cases: string;
    false_positive_indicators: string;
    is_active: number;
    created_at: string;
    updated_at: string;
  }): PIIPattern {
    return {
      id: row.id,
      type: row.type as PIIType,
      pattern: row.pattern,
      description: row.description,
      severity: row.severity as PIISeverity,
      locale: row.locale,
      validation: row.validation,
      examples: row.examples ? JSON.parse(row.examples) : [],
      falsePositives: row.false_positives ? JSON.parse(row.false_positives) : []
    };
  }

  /**
   * Map database row to MalwareHash
   */
  private mapToMalwareHash(row: {
    id: string;
    hash_value: string;
    hash_type: string;
    malware_family?: string;
    threat_severity: string;
    first_seen: string;
    last_seen: string;
    source: string;
    metadata?: string;
  }): MalwareHash {
    return {
      hash: row.hash,
      hashType: row.hash_type as 'md5' | 'sha1' | 'sha256' | 'sha512',
      malwareFamily: row.malware_family,
      threatType: row.threat_type as ThreatType,
      severity: row.severity as ThreatSeverity,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      source: row.source,
      description: row.description
    };
  }

  /**
   * Map database row to SuspiciousIP
   */
  private mapToSuspiciousIP(row: {
    id: string;
    ip_address: string;
    threat_type: string;
    reputation_score: number;
    first_seen: string;
    last_activity: string;
    associated_domains?: string;
    geolocation?: string;
    source: string;
    metadata?: string;
  }): SuspiciousIP {
    return {
      ip: row.ip,
      threatType: row.threat_type as ThreatType,
      severity: row.severity as ThreatSeverity,
      firstSeen: new Date(row.first_seen),
      lastSeen: new Date(row.last_seen),
      source: row.source,
      description: row.description,
      confidence: row.confidence
    };
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): unknown {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  private setCache(key: string, value: unknown): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private clearCache(prefix?: string): void {
    if (prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get threat intelligence statistics
   */
  async getStatistics(): Promise<{
    totalSignatures: number;
    totalPatterns: number;
    totalHashes: number;
    totalIPs: number;
    lastUpdate: Date;
    sources: string[];
  }> {
    const [sigCount, patternCount, hashCount, ipCount, lastUpdate] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM threat_signatures WHERE enabled = TRUE').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM pii_patterns WHERE enabled = TRUE').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM malware_hashes').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM suspicious_ips').first(),
      this.db.prepare('SELECT MAX(last_updated) as last_update FROM threat_intelligence_updates').first()
    ]);

    const sources = await this.db.prepare('SELECT DISTINCT source FROM threat_signatures').all();

    return {
      totalSignatures: sigCount?.count as number || 0,
      totalPatterns: patternCount?.count as number || 0,
      totalHashes: hashCount?.count as number || 0,
      totalIPs: ipCount?.count as number || 0,
      lastUpdate: lastUpdate?.last_update ? new Date(lastUpdate.last_update as string) : new Date(),
      sources: sources.results.map(s => s.source as string)
    };
  }
}