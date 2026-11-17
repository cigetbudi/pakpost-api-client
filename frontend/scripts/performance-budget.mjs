#!/usr/bin/env node
/**
 * Fail closed when production ENTRY bundles exceed PakPost's provisional
 * payload budget. Lazy assets have independent budgets; total dist size is
 * intentionally not treated as initial download size.
 */
import { resolve } from 'node:path';
import { collectBundleMetrics } from './performance-audit.mjs';

export const DEFAULT_BUDGET_KIB = Object.freeze({
  initialJs: 300,
  initialCss: 60,
  editors: 250,
  console: 10,
});

export function checkPerformanceBudget(metrics, limits = DEFAULT_BUDGET_KIB) {
  const issues = [];
  const checks = [
    ['initialJsGzipBytes', 'Initial JS', limits.initialJs],
    ['initialCssGzipBytes', 'Initial CSS', limits.initialCss],
    ['editorChunkGzipBytes', 'Editors lazy chunk', limits.editors],
    ['consoleChunkGzipBytes', 'Console lazy chunk', limits.console],
  ];
  for (const [key, label, maxKiB] of checks) {
    const bytes = metrics[key];
    if (!Number.isFinite(bytes) || bytes < 0) {
      issues.push(`${label}: missing/invalid metric (${key})`);
    } else if (bytes > maxKiB * 1024) {
      issues.push(`${label}: ${(bytes / 1024).toFixed(1)} KiB > ${maxKiB} KiB budget`);
    }
  }
  const entry = new Set(metrics.initialAssets || []);
  if (!metrics.editorChunkGzipBytes) issues.push('Editors chunk is missing; verify lazy loading.');
  if (!metrics.consoleChunkGzipBytes) issues.push('Console chunk is missing; verify lazy loading.');
  if ([...entry].some(file => /\/(?:Editors|PakpostConsole)-[^/]+\.js$/i.test(file))) {
    issues.push('A lazy Editor or Console chunk is unexpectedly listed as an entry asset.');
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    const dist = process.argv[2] || 'dist';
    const metrics = collectBundleMetrics(resolve(dist));
    const issues = checkPerformanceBudget(metrics);
    const kib = n => `${(n / 1024).toFixed(1)} KiB`;
    console.log(`Initial JS: ${kib(metrics.initialJsGzipBytes)} / ${DEFAULT_BUDGET_KIB.initialJs} KiB`);
    console.log(`Initial CSS: ${kib(metrics.initialCssGzipBytes)} / ${DEFAULT_BUDGET_KIB.initialCss} KiB`);
    console.log(`Editors: ${kib(metrics.editorChunkGzipBytes)} / ${DEFAULT_BUDGET_KIB.editors} KiB`);
    console.log(`Console: ${kib(metrics.consoleChunkGzipBytes)} / ${DEFAULT_BUDGET_KIB.console} KiB`);
    if (issues.length) {
      for (const issue of issues) console.error(`FAIL: ${issue}`);
      process.exitCode = 1;
    } else console.log('PASS: Production bundle stays within PakPost payload budgets.');
  } catch (error) {
    console.error(`Performance budget check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
