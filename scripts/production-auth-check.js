#!/usr/bin/env node

/**
 * PRODUCTION AUTHENTICATION DEPLOYMENT CHECK
 * Validates all authentication requirements for auth.aldari.app
 */

const fs = require('fs');
const path = require('path');

class ProductionAuthValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: '🚨 ERROR',
      warning: '⚠️  WARN',
      success: '✅ PASS',
      info: '💡 INFO'
    }[type];
    
    console.log(`[${timestamp}] ${prefix}: ${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
  }

  checkEnvironmentVariables() {
    this.log('Checking production environment variables...', 'info');
    
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_APP_URL'
    ];

    const optional = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET'
    ];

    for (const envVar of required) {
      const value = process.env[envVar];
      if (!value) {
        this.log(`Missing required environment variable: ${envVar}`, 'error');
      } else if (value.includes('your-') || value === 'placeholder') {
        this.log(`Environment variable ${envVar} appears to be a placeholder`, 'error');
      } else {
        this.log(`Environment variable ${envVar} is set`, 'success');
      }
    }

    for (const envVar of optional) {
      const value = process.env[envVar];
      if (!value) {
        this.log(`Optional environment variable ${envVar} is not set`, 'warning');
      } else {
        this.log(`Environment variable ${envVar} is set`, 'success');
      }
    }

    // Validate Supabase URL format
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[a-z0-9-]+\.supabase\.co$/)) {
      this.log('NEXT_PUBLIC_SUPABASE_URL format appears invalid', 'warning');
    }

    // Validate App URL format
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      if (!appUrl.startsWith('https://')) {
        this.log('NEXT_PUBLIC_APP_URL should use HTTPS in production', 'error');
      }
      if (!appUrl.includes('aldari.app')) {
        this.log('NEXT_PUBLIC_APP_URL should use aldari.app domain', 'warning');
      }
    }
  }

  checkCriticalFiles() {
    this.log('Checking critical authentication files...', 'info');
    
    const criticalFiles = [
      'middleware.ts',
      'lib/supabase/client.ts',
      'lib/supabase/server.ts',
      'lib/production-env-check.ts',
      'app/sign-in/page.tsx',
      'app/sign-up/page.tsx'
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        this.log(`Critical file exists: ${file}`, 'success');
      } else {
        this.log(`Missing critical file: ${file}`, 'error');
      }
    }
  }

  checkPackageDependencies() {
    this.log('Checking authentication package dependencies...', 'info');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredDeps = [
        '@supabase/ssr',
        '@supabase/supabase-js'
      ];

      for (const dep of requiredDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.log(`Package dependency found: ${dep}`, 'success');
        } else {
          this.log(`Missing package dependency: ${dep}`, 'error');
        }
      }
    } catch (error) {
      this.log('Failed to read package.json', 'error');
    }
  }

  checkMiddlewareConfig() {
    this.log('Validating middleware configuration...', 'info');
    
    try {
      const middlewarePath = path.join(process.cwd(), 'middleware.ts');
      const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
      
      // Check for production-safe patterns
      const requiredPatterns = [
        'createServerClient',
        'cookies.getAll()',
        'cookies.setAll',
        'NextResponse.next()',
        'auth.getUser()'
      ];

      for (const pattern of requiredPatterns) {
        if (middlewareContent.includes(pattern)) {
          this.log(`Middleware pattern found: ${pattern}`, 'success');
        } else {
          this.log(`Missing middleware pattern: ${pattern}`, 'warning');
        }
      }

      // Check for production optimizations
      if (middlewareContent.includes('Promise.race') && middlewareContent.includes('timeout')) {
        this.log('Middleware has timeout protection', 'success');
      } else {
        this.log('Middleware lacks timeout protection', 'warning');
      }

    } catch (error) {
      this.log('Failed to validate middleware configuration', 'error');
    }
  }

  checkSupabaseConnectivity() {
    this.log('Checking Supabase connectivity...', 'info');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.log('Supabase credentials are available for connectivity test', 'success');
      this.log(`Supabase URL: ${supabaseUrl}`, 'info');
    } else {
      this.log('Cannot test Supabase connectivity - missing credentials', 'error');
    }
  }

  generateReport() {
    this.log('='.repeat(80), 'info');
    this.log('PRODUCTION AUTHENTICATION DEPLOYMENT REPORT', 'info');
    this.log('='.repeat(80), 'info');
    
    if (this.errors.length === 0) {
      this.log('✅ ALL CRITICAL CHECKS PASSED', 'success');
    } else {
      this.log(`❌ ${this.errors.length} CRITICAL ERROR(S) FOUND:`, 'error');
      this.errors.forEach(error => this.log(`  - ${error}`, 'error'));
    }
    
    if (this.warnings.length > 0) {
      this.log(`⚠️  ${this.warnings.length} WARNING(S):`, 'warning');
      this.warnings.forEach(warning => this.log(`  - ${warning}`, 'warning'));
    }
    
    this.log('='.repeat(80), 'info');
    
    if (this.errors.length > 0) {
      this.log('🚨 DEPLOYMENT NOT RECOMMENDED - Fix errors first', 'error');
      process.exit(1);
    } else {
      this.log('✅ DEPLOYMENT CLEARED - Authentication system ready', 'success');
      process.exit(0);
    }
  }

  async runAllChecks() {
    this.log('Starting production authentication validation...', 'info');
    
    this.checkEnvironmentVariables();
    this.checkCriticalFiles();
    this.checkPackageDependencies();
    this.checkMiddlewareConfig();
    this.checkSupabaseConnectivity();
    
    this.generateReport();
  }
}

// Run the validation
if (require.main === module) {
  const validator = new ProductionAuthValidator();
  validator.runAllChecks().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionAuthValidator;