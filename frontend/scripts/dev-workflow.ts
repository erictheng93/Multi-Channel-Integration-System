#!/usr/bin/env bun

// import { readFileSync } from 'fs'; // Not used currently

// 類型定義
type ColorName = 'reset' | 'bright' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan';
type WorkflowType = 'check' | 'lint' | 'fix' | 'build' | 'analyze' | 'perf' | 'dev' | 'test' | 'full';

interface WorkflowStep {
  command: string;
  description: string;
}

const colors: Record<ColorName, string> = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command: string, description: string): boolean {
  log(`\n${colors.blue} ${description}...${colors.reset}`);
  const parts = command.split(' ');
  const result = Bun.spawnSync(parts, { stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode === 0) {
    log(`${colors.green} ${description} completed successfully${colors.reset}`);
    return true;
  } else {
    log(`${colors.red} ${description} failed${colors.reset}`);
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const workflow = (args[0] || 'check') as WorkflowType;

  log(`${colors.cyan}${colors.bright} Frontend Development Workflow${colors.reset}`);
  log(`${colors.yellow}Workflow: ${workflow}${colors.reset}\n`);

  switch (workflow) {
    case 'check':
      log(`${colors.magenta} Running development environment check...${colors.reset}`);
      runCommand('npm run dev-tools:check', 'Development tools check');
      break;

    case 'lint':
      log(`${colors.magenta} Running code quality checks...${colors.reset}`);
      runCommand('npm run lint:check', 'ESLint check');
      runCommand('npm run type-check', 'TypeScript check');
      break;

    case 'fix':
      log(`${colors.magenta} Fixing code issues...${colors.reset}`);
      runCommand('npm run lint', 'ESLint fix');
      break;

    case 'build':
      log(`${colors.magenta} Building for production...${colors.reset}`);
      if (runCommand('npm run type-check', 'TypeScript check') &&
          runCommand('npm run lint:check', 'ESLint check')) {
        runCommand('npm run build', 'Production build');
      }
      break;

    case 'analyze':
      log(`${colors.magenta} Building with bundle analysis...${colors.reset}`);
      runCommand('npm run build:report', 'Bundle analysis');
      break;

    case 'perf':
      log(`${colors.magenta} Performance-optimized build...${colors.reset}`);
      runCommand('npm run build:perf', 'Performance build');
      break;

    case 'dev':
      log(`${colors.magenta} Starting development server...${colors.reset}`);
      runCommand('npm run dev', 'Development server');
      break;

    case 'test':
      log(`${colors.magenta} Running tests...${colors.reset}`);
      runCommand('npm run test:run', 'Test suite');
      break;

    case 'full': {
      log(`${colors.magenta} Running full development workflow...${colors.reset}`);
      const steps: WorkflowStep[] = [
        { command: 'npm run dev-tools:check', description: 'Development tools check' },
        { command: 'npm run type-check', description: 'TypeScript check' },
        { command: 'npm run lint:check', description: 'ESLint check' },
        { command: 'npm run test:run', description: 'Test suite' },
        { command: 'npm run build', description: 'Production build' }
      ];
      
      let allPassed = true;
      for (const { command, description } of steps) {
        if (!runCommand(command, description)) {
          allPassed = false;
          break;
        }
      }
      
      if (allPassed) {
        log(`\n${colors.green}${colors.bright} All checks passed! Your code is ready for deployment.${colors.reset}`);
      } else {
        log(`\n${colors.red}${colors.bright} Some checks failed. Please fix the issues before proceeding.${colors.reset}`);
        process.exit(1);
      }
      break;
    }

    default:
      log(`${colors.yellow}Available workflows:${colors.reset}`);
      log(`  ${colors.cyan}check${colors.reset} - Check development environment`);
      log(`  ${colors.cyan}lint${colors.reset} - Run code quality checks`);
      log(`  ${colors.cyan}fix${colors.reset} - Fix code issues automatically`);
      log(`  ${colors.cyan}build${colors.reset} - Build for production`);
      log(`  ${colors.cyan}analyze${colors.reset} - Build with bundle analysis`);
      log(`  ${colors.cyan}perf${colors.reset} - Performance-optimized build`);
      log(`  ${colors.cyan}dev${colors.reset} - Start development server`);
      log(`  ${colors.cyan}test${colors.reset} - Run tests`);
      log(`  ${colors.cyan}full${colors.reset} - Run complete workflow`);
      log(`\n${colors.yellow}Usage: npm run workflow [workflow-name]${colors.reset}`);
      break;
  }
}

main().catch(console.error);