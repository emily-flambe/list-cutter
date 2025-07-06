import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/services/auth/password';

describe('Password Service', () => {
  describe('hashPassword', () => {
    it('should hash a password and return Django-compatible format', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);

      // Check Django format: pbkdf2_sha256$iterations$salt$hash
      expect(hash).toMatch(/^pbkdf2_sha256\$\d+\$.+\$.+$/);
      
      const parts = hash.split('$');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('pbkdf2_sha256');
      expect(parseInt(parts[1])).toBe(600000); // Default iterations
      expect(parts[2]).toBeTruthy(); // Salt should exist
      expect(parts[3]).toBeTruthy(); // Hash should exist
    });

    it('should generate different hashes for the same password (due to random salt)', async () => {
      const password = 'testpassword123';
      
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should handle empty passwords', async () => {
      const hash = await hashPassword('');
      expect(hash).toMatch(/^pbkdf2_sha256\$\d+\$.+\$.+$/);
      expect(await verifyPassword('', hash)).toBe(true);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      
      expect(hash).toMatch(/^pbkdf2_sha256\$\d+\$.+\$.+$/);
      expect(await verifyPassword(longPassword, hash)).toBe(true);
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
      const hash = await hashPassword(specialPassword);
      
      expect(hash).toMatch(/^pbkdf2_sha256\$\d+\$.+\$.+$/);
      expect(await verifyPassword(specialPassword, hash)).toBe(true);
    });

    it('should handle Unicode characters in passwords', async () => {
      const unicodePassword = '🔒🔑密码πάσσωορδ';
      const hash = await hashPassword(unicodePassword);
      
      expect(hash).toMatch(/^pbkdf2_sha256\$\d+\$.+\$.+$/);
      expect(await verifyPassword(unicodePassword, hash)).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct passwords', async () => {
      const password = 'correctpassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'correctpassword123';
      const wrongPassword = 'wrongpassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should reject malformed hash formats', async () => {
      const password = 'testpassword';
      
      const malformedHashes = [
        '',
        'not-a-hash',
        'md5$salt$hash', // Wrong algorithm
        'pbkdf2_sha256$iterations$salt', // Missing hash part
        'pbkdf2_sha256$iterations$salt$hash$extra', // Too many parts
        'pbkdf2_sha256$invalid$salt$hash', // Invalid iterations
        'pbkdf2_sha256$600000$$hash', // Empty salt
        'pbkdf2_sha256$600000$salt$', // Empty hash
      ];

      for (const malformedHash of malformedHashes) {
        const isValid = await verifyPassword(password, malformedHash);
        expect(isValid).toBe(false);
      }
    });

    it('should handle invalid base64 in salt or hash', async () => {
      const password = 'testpassword';
      
      const invalidHashes = [
        'pbkdf2_sha256$600000$invalid-base64!@#$salt',
        'pbkdf2_sha256$600000$dGVzdA==$invalid-base64!@#$hash',
      ];

      for (const invalidHash of invalidHashes) {
        const isValid = await verifyPassword(password, invalidHash);
        expect(isValid).toBe(false);
      }
    });

    it('should be case sensitive', async () => {
      const password = 'CaseSensitivePassword';
      const hash = await hashPassword(password);
      
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword(password.toLowerCase(), hash)).toBe(false);
      expect(await verifyPassword(password.toUpperCase(), hash)).toBe(false);
    });

    it('should handle edge cases gracefully', async () => {
      const password = 'testpassword';
      
      // These should all return false without throwing errors
      expect(await verifyPassword(password, null as any)).toBe(false);
      expect(await verifyPassword(password, undefined as any)).toBe(false);
      expect(await verifyPassword(null as any, 'somehash')).toBe(false);
      expect(await verifyPassword(undefined as any, 'somehash')).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('should use secure iteration count', async () => {
      const password = 'testpassword';
      const hash = await hashPassword(password);
      
      const parts = hash.split('$');
      const iterations = parseInt(parts[1]);
      
      // Should use at least 100,000 iterations (current default is 600,000)
      expect(iterations).toBeGreaterThan(100000);
      expect(iterations).toBe(600000); // Verify current default
    });

    it('should generate cryptographically random salts', async () => {
      const password = 'testpassword';
      const hashes = [];
      
      // Generate multiple hashes
      for (let i = 0; i < 10; i++) {
        hashes.push(await hashPassword(password));
      }
      
      // Extract salts
      const salts = hashes.map(hash => hash.split('$')[2]);
      
      // All salts should be unique (very high probability with crypto random)
      const uniqueSalts = new Set(salts);
      expect(uniqueSalts.size).toBe(salts.length);
      
      // All salts should have reasonable length (base64 encoded 16 bytes ≈ 24 chars)
      salts.forEach(salt => {
        expect(salt.length).toBeGreaterThan(20);
        expect(salt.length).toBeLessThan(30);
      });
    });

    it('should produce different hashes for similar passwords', async () => {
      const passwords = [
        'password123',
        'password124', // One character different
        'Password123', // Case different
        'password123 ', // Trailing space
      ];
      
      const hashes = await Promise.all(passwords.map(p => hashPassword(p)));
      
      // All hashes should be different
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
      
      // Cross-verification should all fail
      for (let i = 0; i < passwords.length; i++) {
        for (let j = 0; j < hashes.length; j++) {
          if (i !== j) {
            expect(await verifyPassword(passwords[i], hashes[j])).toBe(false);
          }
        }
      }
    });

    it('should be resistant to timing attacks', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      // Measure verification time for correct password
      const correctTimes = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await verifyPassword(password, hash);
        correctTimes.push(performance.now() - start);
      }
      
      // Measure verification time for incorrect password
      const incorrectTimes = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await verifyPassword('wrongpassword123', hash);
        incorrectTimes.push(performance.now() - start);
      }
      
      const avgCorrectTime = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
      const avgIncorrectTime = incorrectTimes.reduce((a, b) => a + b) / incorrectTimes.length;
      
      // Times should be similar (within 50% of each other)
      // This is a basic check - true timing attack resistance requires more sophisticated testing
      const ratio = Math.max(avgCorrectTime, avgIncorrectTime) / Math.min(avgCorrectTime, avgIncorrectTime);
      expect(ratio).toBeLessThan(1.5);
    });
  });

  describe('Performance Tests', () => {
    it('should hash passwords within reasonable time limits', async () => {
      const password = 'testpassword123';
      
      const start = performance.now();
      await hashPassword(password);
      const duration = performance.now() - start;
      
      // Should complete within 2 seconds (PBKDF2 with 600k iterations)
      // This is relatively slow by design for security
      expect(duration).toBeLessThan(2000);
      expect(duration).toBeGreaterThan(10); // Should take some meaningful time
    });

    it('should verify passwords within reasonable time limits', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      const start = performance.now();
      await verifyPassword(password, hash);
      const duration = performance.now() - start;
      
      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      expect(duration).toBeGreaterThan(10); // Should take some meaningful time
    });

    it('should handle concurrent operations', async () => {
      const passwords = ['pass1', 'pass2', 'pass3', 'pass4', 'pass5'];
      
      const start = performance.now();
      
      // Hash all passwords concurrently
      const hashes = await Promise.all(passwords.map(p => hashPassword(p)));
      
      // Verify all passwords concurrently
      const verifications = await Promise.all(
        passwords.map((p, i) => verifyPassword(p, hashes[i]))
      );
      
      const duration = performance.now() - start;
      
      // All verifications should succeed
      expect(verifications.every(v => v === true)).toBe(true);
      
      // Concurrent operations should be faster than sequential
      // (Though still constrained by CPU for PBKDF2)
      expect(duration).toBeLessThan(10000); // 10 seconds for 5 operations
    });
  });

  describe('Django Compatibility', () => {
    it('should produce hashes compatible with Django format', async () => {
      const password = 'djangocompatible';
      const hash = await hashPassword(password);
      
      // Django format: pbkdf2_sha256$iterations$salt$hash
      const djangoPattern = /^pbkdf2_sha256\$\d+\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/;
      expect(hash).toMatch(djangoPattern);
      
      // Should be able to verify
      expect(await verifyPassword(password, hash)).toBe(true);
    });

    // This test would require a known Django-generated hash for full compatibility testing
    it('should be able to verify a Django-generated hash (mock)', async () => {
      // This is a mock test - in a real scenario, you'd use an actual Django-generated hash
      const password = 'testpassword';
      const ourHash = await hashPassword(password);
      
      // Our implementation should verify its own hashes
      expect(await verifyPassword(password, ourHash)).toBe(true);
      
      // Format should match Django expectations
      expect(ourHash.startsWith('pbkdf2_sha256$600000$')).toBe(true);
    });
  });
});