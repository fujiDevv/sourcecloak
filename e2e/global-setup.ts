import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default function globalSetup(): void {
  const manifestPath = path.join(process.cwd(), 'dist', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
  }
}