import { Hono } from 'hono';
import { ProductionValidation } from '../../services/deployment/production-validation.js';
import { 
  ValidationContext,
  ValidationResult,
  DeploymentEnvironment
} from '../../types/deployment.js';
import { Env } from '../../types/env.js';

/**
 * Routes for deployment validation operations
 * Provides endpoints to run validation tests and query validation results
 */
export function createValidationRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * Run complete validation suite
   * POST /api/deployment/validation/complete
   */
  app.post('/complete', async (c) => {
    try {
      const { environment, context } = await c.req.json();

      // Validate environment
      if (!environment || !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      // Create validation context with defaults
      const validationContext: ValidationContext = {
        environment,
        version: context?.version || 'latest',
        baseUrl: context?.baseUrl || c.env.BASE_URL || `https://${c.env.DOMAIN}`,
        userAgent: context?.userAgent || 'ListCutter-ProductionValidation/1.0',
        timeout: context?.timeout || 10000,
        retries: context?.retries || 3
      };

      // Create validation service
      const validation = new ProductionValidation(
        c.env.ANALYTICS, 
        c.env.DB, 
        validationContext.baseUrl
      );

      // Run complete validation
      const result = await validation.validateComplete(environment, validationContext);

      return c.json({
        success: true,
        validation: result,
        environment,
        context: validationContext
      });

    } catch (error) {
      console.error('Failed to run complete validation:', error);
      return c.json({ 
        error: 'Failed to run complete validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Run authentication validation only
   * POST /api/deployment/validation/authentication
   */
  app.post('/authentication', async (c) => {
    try {
      const { environment, context } = await c.req.json();

      if (!environment || !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const validationContext: ValidationContext = {
        environment,
        version: context?.version || 'latest',
        baseUrl: context?.baseUrl || c.env.BASE_URL || `https://${c.env.DOMAIN}`,
        userAgent: context?.userAgent || 'ListCutter-ProductionValidation/1.0',
        timeout: context?.timeout || 10000,
        retries: context?.retries || 3
      };

      const validation = new ProductionValidation(
        c.env.ANALYTICS, 
        c.env.DB, 
        validationContext.baseUrl
      );

      const result = await validation.validateAuthentication(validationContext);

      return c.json({
        success: true,
        validation: result,
        environment,
        category: 'authentication'
      });

    } catch (error) {
      console.error('Failed to run authentication validation:', error);
      return c.json({ 
        error: 'Failed to run authentication validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Run file operations validation only
   * POST /api/deployment/validation/file-operations
   */
  app.post('/file-operations', async (c) => {
    try {
      const { environment, context } = await c.req.json();

      if (!environment || !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const validationContext: ValidationContext = {
        environment,
        version: context?.version || 'latest',
        baseUrl: context?.baseUrl || c.env.BASE_URL || `https://${c.env.DOMAIN}`,
        userAgent: context?.userAgent || 'ListCutter-ProductionValidation/1.0',
        timeout: context?.timeout || 15000, // Longer timeout for file ops
        retries: context?.retries || 3
      };

      const validation = new ProductionValidation(
        c.env.ANALYTICS, 
        c.env.DB, 
        validationContext.baseUrl
      );

      const result = await validation.validateFileOperations(validationContext);

      return c.json({
        success: true,
        validation: result,
        environment,
        category: 'file-operations'
      });

    } catch (error) {
      console.error('Failed to run file operations validation:', error);
      return c.json({ 
        error: 'Failed to run file operations validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Run data integrity validation only
   * POST /api/deployment/validation/data-integrity
   */
  app.post('/data-integrity', async (c) => {
    try {
      const { environment, context } = await c.req.json();

      if (!environment || !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const validationContext: ValidationContext = {
        environment,
        version: context?.version || 'latest',
        baseUrl: context?.baseUrl || c.env.BASE_URL || `https://${c.env.DOMAIN}`,
        userAgent: context?.userAgent || 'ListCutter-ProductionValidation/1.0',
        timeout: context?.timeout || 10000,
        retries: context?.retries || 3
      };

      const validation = new ProductionValidation(
        c.env.ANALYTICS, 
        c.env.DB, 
        validationContext.baseUrl
      );

      const result = await validation.validateDataIntegrity(validationContext);

      return c.json({
        success: true,
        validation: result,
        environment,
        category: 'data-integrity'
      });

    } catch (error) {
      console.error('Failed to run data integrity validation:', error);
      return c.json({ 
        error: 'Failed to run data integrity validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Run performance validation only
   * POST /api/deployment/validation/performance
   */
  app.post('/performance', async (c) => {
    try {
      const { environment, context } = await c.req.json();

      if (!environment || !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const validationContext: ValidationContext = {
        environment,
        version: context?.version || 'latest',
        baseUrl: context?.baseUrl || c.env.BASE_URL || `https://${c.env.DOMAIN}`,
        userAgent: context?.userAgent || 'ListCutter-ProductionValidation/1.0',
        timeout: context?.timeout || 15000,
        retries: context?.retries || 3
      };

      const validation = new ProductionValidation(
        c.env.ANALYTICS, 
        c.env.DB, 
        validationContext.baseUrl
      );

      const result = await validation.validatePerformance(validationContext);

      return c.json({
        success: true,
        validation: result,
        environment,
        category: 'performance'
      });

    } catch (error) {
      console.error('Failed to run performance validation:', error);
      return c.json({ 
        error: 'Failed to run performance validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get validation history
   * GET /api/deployment/validation/history
   */
  app.get('/history', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '50');

      if (limit > 100) {
        return c.json({ error: 'Limit cannot exceed 100' }, 400);
      }

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const validCategories = ['authentication', 'file-operations', 'data-integrity', 'performance'];
      if (category && !validCategories.includes(category)) {
        return c.json({ 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        }, 400);
      }

      const validation = new ProductionValidation(
        c.env.ANALYTICS, 
        c.env.DB, 
        c.env.BASE_URL || `https://${c.env.DOMAIN}`
      );

      const history = await validation.getValidationHistory(environment, limit);

      return c.json({
        success: true,
        history,
        totalCount: history.length,
        filters: {
          environment,
          category,
          limit
        }
      });

    } catch (error) {
      console.error('Failed to get validation history:', error);
      return c.json({ 
        error: 'Failed to get validation history',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get validation results for specific time range
   * GET /api/deployment/validation/results
   */
  app.get('/results', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const category = c.req.query('category');
      const startTime = c.req.query('startTime');
      const endTime = c.req.query('endTime');
      const success = c.req.query('success'); // Filter by success/failure

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const validCategories = ['authentication', 'file-operations', 'data-integrity', 'performance'];
      if (category && !validCategories.includes(category)) {
        return c.json({ 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        }, 400);
      }

      if (success && !['true', 'false'].includes(success)) {
        return c.json({ error: 'Success filter must be "true" or "false"' }, 400);
      }

      let query = `
        SELECT * FROM deployment_validation_results 
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (environment) {
        query += ` AND environment = ?`;
        params.push(environment);
      }

      if (startTime) {
        query += ` AND timestamp >= ?`;
        params.push(startTime);
      }

      if (endTime) {
        query += ` AND timestamp <= ?`;
        params.push(endTime);
      }

      if (success) {
        query += ` AND success = ?`;
        params.push(success === 'true' ? 1 : 0);
      }

      query += ` ORDER BY timestamp DESC LIMIT 100`;

      const results = await c.env.DB
        .prepare(query)
        .bind(...params)
        .all();

      const validationResults = results.results.map((row: any) => {
        let parsedResults;
        try {
          parsedResults = row.results_json ? JSON.parse(row.results_json) : {};
        } catch (error) {
          parsedResults = {};
        }

        const result = {
          environment: row.environment,
          timestamp: row.timestamp,
          success: Boolean(row.success),
          duration: row.duration,
          results: parsedResults
        };

        // Filter by category if requested
        if (category && parsedResults[category]) {
          return {
            ...result,
            results: { [category]: parsedResults[category] }
          };
        }

        return result;
      });

      return c.json({
        success: true,
        results: validationResults,
        totalCount: validationResults.length,
        filters: {
          environment,
          category,
          startTime,
          endTime,
          success: success ? (success === 'true') : undefined
        }
      });

    } catch (error) {
      console.error('Failed to get validation results:', error);
      return c.json({ 
        error: 'Failed to get validation results',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get validation test details
   * GET /api/deployment/validation/tests
   */
  app.get('/tests', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const category = c.req.query('category');
      const testName = c.req.query('testName');
      const success = c.req.query('success');
      const limit = parseInt(c.req.query('limit') || '100');

      if (limit > 500) {
        return c.json({ error: 'Limit cannot exceed 500' }, 400);
      }

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      if (success && !['true', 'false'].includes(success)) {
        return c.json({ error: 'Success filter must be "true" or "false"' }, 400);
      }

      let query = `
        SELECT * FROM deployment_validation_tests 
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (environment) {
        query += ` AND environment = ?`;
        params.push(environment);
      }

      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }

      if (testName) {
        query += ` AND test_name LIKE ?`;
        params.push(`%${testName}%`);
      }

      if (success) {
        query += ` AND success = ?`;
        params.push(success === 'true' ? 1 : 0);
      }

      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const results = await c.env.DB
        .prepare(query)
        .bind(...params)
        .all();

      const tests = results.results.map((row: any) => ({
        environment: row.environment,
        timestamp: row.timestamp,
        category: row.category,
        testName: row.test_name,
        testType: row.test_type,
        success: Boolean(row.success),
        duration: row.duration,
        errorMessage: row.error_message
      }));

      return c.json({
        success: true,
        tests,
        totalCount: tests.length,
        filters: {
          environment,
          category,
          testName,
          success: success ? (success === 'true') : undefined,
          limit
        }
      });

    } catch (error) {
      console.error('Failed to get validation tests:', error);
      return c.json({ 
        error: 'Failed to get validation tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get validation metrics summary
   * GET /api/deployment/validation/metrics
   */
  app.get('/metrics', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const hours = parseInt(c.req.query('hours') || '24');

      if (hours > 168) { // Max 1 week
        return c.json({ error: 'Hours cannot exceed 168 (1 week)' }, 400);
      }

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const timeFilter = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

      // Get validation statistics
      let statsQuery = `
        SELECT 
          COUNT(*) as total_validations,
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful_validations,
          AVG(duration) as avg_duration
        FROM deployment_validation_results 
        WHERE timestamp >= ?
      `;
      const params: unknown[] = [timeFilter];

      if (environment) {
        statsQuery += ` AND environment = ?`;
        params.push(environment);
      }

      const stats = await c.env.DB
        .prepare(statsQuery)
        .bind(...params)
        .first();

      // Get test statistics by category
      let categoryQuery = `
        SELECT 
          category,
          COUNT(*) as total_tests,
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful_tests,
          AVG(duration) as avg_duration
        FROM deployment_validation_tests 
        WHERE timestamp >= ?
      `;
      const categoryParams: unknown[] = [timeFilter];

      if (environment) {
        categoryQuery += ` AND environment = ?`;
        categoryParams.push(environment);
      }

      categoryQuery += ` GROUP BY category`;

      const categoryResults = await c.env.DB
        .prepare(categoryQuery)
        .bind(...categoryParams)
        .all();

      const testsByCategory = categoryResults.results.reduce((acc: Record<string, any>, row: any) => {
        acc[row.category] = {
          totalTests: row.total_tests,
          successfulTests: row.successful_tests,
          successRate: row.total_tests > 0 ? ((row.successful_tests / row.total_tests) * 100).toFixed(2) : '0',
          avgDuration: row.avg_duration ? parseFloat(row.avg_duration.toFixed(2)) : 0
        };
        return acc;
      }, {});

      return c.json({
        success: true,
        metrics: {
          totalValidations: stats?.total_validations || 0,
          successfulValidations: stats?.successful_validations || 0,
          successRate: stats?.total_validations 
            ? ((stats.successful_validations / stats.total_validations) * 100).toFixed(2)
            : '0',
          averageDuration: stats?.avg_duration ? parseFloat(stats.avg_duration.toFixed(2)) : 0,
          testsByCategory
        },
        timeRange: {
          hours,
          since: timeFilter,
          environment
        }
      });

    } catch (error) {
      console.error('Failed to get validation metrics:', error);
      return c.json({ 
        error: 'Failed to get validation metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Health check for validation service
   * GET /api/deployment/validation/health
   */
  app.get('/health', async (c) => {
    try {
      // Test database connectivity
      const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
      const dbHealthy = dbTest?.test === 1;

      // Test analytics connectivity
      let analyticsHealthy = true;
      try {
        await c.env.ANALYTICS.writeDataPoint({
          blobs: ['health_check', 'validation_service'],
          doubles: [Date.now()],
          indexes: ['health']
        });
      } catch (error) {
        analyticsHealthy = false;
      }

      // Test external endpoint reachability
      const baseUrl = c.env.BASE_URL || `https://${c.env.DOMAIN}`;
      let endpointHealthy = true;
      try {
        const response = await fetch(`${baseUrl}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        endpointHealthy = response.ok;
      } catch (error) {
        endpointHealthy = false;
      }

      const healthy = dbHealthy && analyticsHealthy && endpointHealthy;

      return c.json({
        success: true,
        healthy,
        components: {
          database: dbHealthy,
          analytics: analyticsHealthy,
          endpoint: endpointHealthy
        },
        baseUrl,
        timestamp: new Date().toISOString()
      }, healthy ? 200 : 503);

    } catch (error) {
      console.error('Validation health check failed:', error);
      return c.json({ 
        healthy: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 503);
    }
  });

  return app;
}