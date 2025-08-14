#!/usr/bin/env node

/**
 * Production Validation Script for auth.aldari.app
 * Validates Edge Runtime compatibility and production readiness
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 ALDARI Production Validation Starting...\n');

// Critical validation checks
const validations = {
  edgeRuntimeCompatibility: checkEdgeRuntimeCompatibility,
  environmentVariables: checkEnvironmentVariables,
  middlewareConfig: checkMiddlewareConfig,
  buildConfiguration: checkBuildConfiguration,
  securityHeaders: checkSecurityHeaders,
};

async function main() {
  let allPassed = true;
  const results = {};

  for (const [name, validator] of Object.entries(validations)) {
    console.log(`🔍 Running ${name}...`);
    try {
      const result = await validator();
      results[name] = result;
      
      if (result.passed) {
        console.log(`✅ ${name}: PASSED`);
      } else {
        console.log(`❌ ${name}: FAILED`);
        result.issues.forEach(issue => console.log(`   - ${issue}`));
        allPassed = false;
      }
    } catch (error) {
      console.error(`💥 ${name}: ERROR - ${error.message}`);
      allPassed = false;
    }
    console.log('');
  }

  // Final report
  console.log('📊 PRODUCTION VALIDATION SUMMARY');
  console.log('================================');
  
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED - Ready for Production Deployment!');
    console.log('\n🚀 Deployment Steps:');
    console.log('1. Ensure all environment variables are set in Vercel');
    console.log('2. Deploy with: vercel --prod');
    console.log('3. Monitor logs for any Edge Runtime issues');
    console.log('4. Test authentication flow on production domain');
  } else {
    console.log('⚠️  CRITICAL ISSUES FOUND - Fix before deploying to production');
    console.log('\n🔧 Required Actions:');
    
    Object.entries(results).forEach(([name, result]) => {
      if (!result.passed && result.issues) {
        console.log(`\n${name}:`);
        result.issues.forEach(issue => console.log(`  - ${issue}`));
      }
    });
  }
  
  process.exit(allPassed ? 0 : 1);
}

function checkEdgeRuntimeCompatibility() {
  const issues = [];
  const middlewarePath = path.join(__dirname, '../middleware.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    issues.push('middleware.ts not found');
    return { passed: false, issues };
  }

  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for Node.js APIs that don't work in Edge Runtime
  const incompatibleAPIs = [
    'setInterval',
    'setTimeout',
    'clearInterval', 
    'clearTimeout',
    'process.on',
    'Buffer.',
    'fs.',
    'net.',
    'crypto.createHash',
    'crypto.randomBytes'
  ];

  incompatibleAPIs.forEach(api => {
    if (middlewareContent.includes(api)) {
      issues.push(`Found incompatible API: ${api}`);
    }
  });

  // Check for required imports
  if (!middlewareContent.includes('@supabase/ssr')) {
    issues.push('Missing @supabase/ssr import');
  }

  // Check middleware export
  if (!middlewareContent.includes('export async function middleware')) {
    issues.push('Missing middleware function export');
  }

  // Check config export
  if (!middlewareContent.includes('export const config')) {
    issues.push('Missing config export');
  }

  return { passed: issues.length === 0, issues };
}

function checkEnvironmentVariables() {
  const issues = [];
  const envExamplePath = path.join(__dirname, '../.env.example');
  
  if (!fs.existsSync(envExamplePath)) {
    issues.push('.env.example not found');
    return { passed: false, issues };
  }

  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Critical env vars for Supabase auth
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_APP_URL'
  ];

  requiredVars.forEach(varName => {
    if (!envContent.includes(varName)) {
      issues.push(`Missing environment variable: ${varName}`);
    }
  });

  return { passed: issues.length === 0, issues };
}

function checkMiddlewareConfig() {
  const issues = [];
  const middlewarePath = path.join(__dirname, '../middleware.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    issues.push('middleware.ts not found');
    return { passed: false, issues };
  }

  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check matcher configuration
  if (!middlewareContent.includes('matcher')) {
    issues.push('Missing matcher configuration');
  }

  // Check for proper route exclusions
  const shouldExclude = ['/_next/', '/_vercel'];
  shouldExclude.forEach(pattern => {
    if (!middlewareContent.includes(pattern)) {
      issues.push(`Missing exclusion for: ${pattern}`);
    }
  });

  return { passed: issues.length === 0, issues };
}

function checkBuildConfiguration() {
  const issues = [];
  const nextConfigPath = path.join(__dirname, '../next.config.ts');
  
  if (!fs.existsSync(nextConfigPath)) {
    issues.push('next.config.ts not found');
    return { passed: false, issues };
  }

  const configContent = fs.readFileSync(nextConfigPath, 'utf8');
  
  // Check for production optimizations
  if (!configContent.includes('reactStrictMode')) {
    issues.push('reactStrictMode should be enabled');
  }

  // Check security headers
  if (!configContent.includes('headers()')) {
    issues.push('Security headers not configured');
  }

  return { passed: issues.length === 0, issues };
}

function checkSecurityHeaders() {
  const issues = [];
  const middlewarePath = path.join(__dirname, '../middleware.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    issues.push('middleware.ts not found');
    return { passed: false, issues };
  }

  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Critical security headers
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options', 
    'X-XSS-Protection',
    'Referrer-Policy'
  ];

  requiredHeaders.forEach(header => {
    if (!middlewareContent.includes(header)) {
      issues.push(`Missing security header: ${header}`);
    }
  });

  return { passed: issues.length === 0, issues };
}

// Run validation
main().catch(error => {
  console.error('💥 Validation failed:', error);
  process.exit(1);
});