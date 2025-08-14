/**
 * Environment Validation Utility
 * Validates required environment variables and provides helpful error messages
 */

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, any>;
}

export function validateEnvironment(): EnvValidationResult {
  const result: EnvValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    config: {},
  };

  // Required environment variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  // Optional but recommended
  const recommended = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
  ];

  // Check required variables
  for (const key of required) {
    const value = process.env[key];
    if (!value) {
      result.errors.push(`Missing required environment variable: ${key}`);
      result.isValid = false;
    } else if (value.length < 10) {
      result.warnings.push(`Environment variable ${key} seems too short (${value.length} chars)`);
    } else {
      result.config[key] = {
        length: value.length,
        present: true,
        prefix: value.substring(0, 10) + '...',
      };
    }
  }

  // Check recommended variables
  for (const key of recommended) {
    const value = process.env[key];
    if (!value) {
      result.warnings.push(`Recommended environment variable missing: ${key}`);
    } else {
      result.config[key] = {
        length: value.length,
        present: true,
        prefix: key.includes('URL') ? value : value.substring(0, 10) + '...',
      };
    }
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('.supabase.co')) {
    result.warnings.push('NEXT_PUBLIC_SUPABASE_URL does not appear to be a valid Supabase URL');
  }

  // Check for common mistakes
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && !anonKey.startsWith('eyJ')) {
    result.warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY does not appear to be a valid JWT token');
  }

  return result;
}

export function logEnvironmentStatus() {
  const validation = validateEnvironment();
  
  console.group('🔧 Environment Configuration');
  
  if (validation.isValid) {
    console.log('✅ All required environment variables are present');
  } else {
    console.error('❌ Environment validation failed');
    validation.errors.forEach(error => console.error(`  • ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    validation.warnings.forEach(warning => console.warn(`  • ${warning}`));
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Configuration:', validation.config);
  }
  
  console.groupEnd();
  
  return validation;
}

export function createEnvironmentReport(): string {
  const validation = validateEnvironment();
  
  let report = '# Environment Configuration Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Environment: ${process.env.NODE_ENV}\n\n`;

  if (validation.isValid) {
    report += '✅ Status: All required variables present\n\n';
  } else {
    report += '❌ Status: Missing required variables\n\n';
    report += '## Errors\n';
    validation.errors.forEach(error => {
      report += `- ${error}\n`;
    });
    report += '\n';
  }

  if (validation.warnings.length > 0) {
    report += '## Warnings\n';
    validation.warnings.forEach(warning => {
      report += `- ${warning}\n`;
    });
    report += '\n';
  }

  report += '## Configuration Summary\n';
  Object.entries(validation.config).forEach(([key, config]) => {
    report += `- ${key}: ${(config as any).present ? '✅' : '❌'} (${(config as any).length} chars)\n`;
  });

  return report;
}