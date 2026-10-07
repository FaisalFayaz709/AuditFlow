import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
}
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
function allSourceFiles(): string[] {
  return ['backend/src', 'frontend/src']
    .map((dir) => join(root, dir))
    .filter(existsSync)
    .flatMap(walk)
    .filter((file) => /\.(ts|tsx)$/.test(file));
}

describe('Pass 14 locked architecture and stack acceptance invariants', () => {
  it('keeps the backend on Fastify + TypeScript + Prisma/PostgreSQL only', () => {
    const backendPackage = readJson('backend/package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = {
      ...backendPackage.dependencies,
      ...backendPackage.devDependencies,
    };

    expect(dependencies.fastify).toBeDefined();
    expect(dependencies['@prisma/client']).toBeDefined();
    expect(dependencies.prisma).toBeDefined();
    expect(dependencies.typescript).toBeDefined();

    for (const forbidden of ['express', '@nestjs/core', 'typeorm', 'sequelize', 'mongoose', 'mysql2', 'sqlite3', 'kafkajs', 'bullmq', 'ioredis']) {
      expect(dependencies[forbidden], `${forbidden} must not be introduced before its allowed phase`).toBeUndefined();
    }
  });

  it('keeps the frontend on React + TypeScript + Vite only', () => {
    const frontendPackage = readJson('frontend/package.json') as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = {
      ...frontendPackage.dependencies,
      ...frontendPackage.devDependencies,
    };

    expect(dependencies.react).toBeDefined();
    expect(dependencies.vite).toBeDefined();
    expect(dependencies.typescript).toBeDefined();

    for (const forbidden of ['next', 'nuxt', '@angular/core', 'svelte', 'webpack']) {
      expect(dependencies[forbidden], `${forbidden} must not replace the locked frontend stack`).toBeUndefined();
    }
  });

  it('keeps the database provider locked to PostgreSQL', () => {
    const prisma = readFileSync(join(root, 'backend/prisma/schema.prisma'), 'utf8');
    expect(prisma).toContain('provider = "postgresql"');
    expect(prisma).not.toContain('provider = "mysql"');
    expect(prisma).not.toContain('provider = "sqlite"');
    expect(prisma).not.toContain('provider = "mongodb"');
  });

  it('does not introduce browser JWT handling in application source', () => {
    const offenders = allSourceFiles()
      .filter((file) => {
        const text = readFileSync(file, 'utf8').toLowerCase();
        return text.includes('bearer ') || text.includes('jsonwebtoken') || text.includes('jwt access') || text.includes('access_token') || text.includes('refresh_token');
      })
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });
});
