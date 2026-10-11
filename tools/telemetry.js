#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.codex', 'telemetry_config.json');
const DEFAULT_EXPORT_DIR = path.join(os.homedir(), '.codex', 'telemetry_exports');
const ALLOWED_TRIGGERS = new Set(['idle_timeout', 'lesson_switch', 'manual', 'session_end']);
const ALLOWED_STATUSES = new Set(['clear', 'partial', 'stuck']);
const ALLOWED_LESSON_CONFIDENCE = new Set(['high', 'medium', 'low']);
const ALLOWED_GAPS = new Set(['concept', 'debugging', 'repo-navigation', 'problem-decomposition', 'tool-usage', 'assignment-reading', 'git-workflow']);

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config || DEFAULT_CONFIG_PATH);
  const payload = buildPayload(args, config);

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(0);
  }

  postPayload(config, payload)
    .then((response) => {
      appendExport(config, payload, response, null);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      process.exit(0);
    })
    .catch((error) => {
      appendExport(config, payload, null, error.message || String(error));
      process.stderr.write(`${error.message || String(error)}\n`);
      process.exit(1);
    });
}

function parseArgs(argv) {
  const args = {
    gaps: [],
    causes: [],
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    if (key === 'dry-run') {
      args.dryRun = true;
      continue;
    }

    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    switch (key) {
      case 'config':
        args.config = next;
        break;
      case 'batch':
        args.batchId = next;
        break;
      case 'student-id':
        args.studentId = next;
        break;
      case 'student-name':
        args.studentName = next;
        break;
      case 'project':
        args.projectId = next;
        break;
      case 'trigger':
        args.trigger = next;
        break;
      case 'status':
        args.status = next;
        break;
      case 'progress':
        args.progress = Number(next);
        break;
      case 'confidence':
        args.confidence = Number(next);
        break;
      case 'lesson-confidence':
        args.lessonConfidence = next;
        break;
      case 'summary':
        args.summary = next;
        break;
      case 'action':
        args.action = next;
        break;
      case 'repeated':
        args.repeated = Number(next);
        break;
      case 'report-date':
        args.reportDate = next;
        break;
      case 'month':
        args.month = Number(next);
        break;
      case 'week':
        args.week = Number(next);
        break;
      case 'day':
        args.day = Number(next);
        break;
      case 'path':
        args.path = next;
        break;
      case 'lesson-path':
        args.lessonPath = next;
        break;
      case 'assignment-path':
        args.assignmentPath = next;
        break;
      case 'gap':
        args.gaps.push(next);
        break;
      case 'cause':
        args.causes.push(next);
        break;
      default:
        break;
    }

    i += 1;
  }

  return args;
}

function loadConfig(configPath) {
  const resolvedPath = expandHome(configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Telemetry config not found: ${resolvedPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const endpoint = String(raw.endpoint || '').trim();
  const token = String(raw.token || '').trim();
  const timeoutSeconds = Number(raw.timeout_seconds || 10);
  const exportDir = expandHome(raw.export_dir || DEFAULT_EXPORT_DIR);

  if (!endpoint) {
    throw new Error("Telemetry config is missing 'endpoint'.");
  }
  if (!token) {
    throw new Error("Telemetry config is missing 'token'.");
  }

  return {
    endpoint,
    token,
    timeoutSeconds,
    exportDir,
    batchId: raw.batch_id || 'batch-1',
    studentId: raw.student_id || null,
    studentName: raw.student_name || null,
    projectId: raw.project_id || null,
  };
}

function buildPayload(args, config) {
  validateRequired(args.trigger, '--trigger');
  validateRequired(args.status, '--status');
  validateRequired(args.summary, '--summary');
  validateRequired(args.action, '--action');
  validateEnum(args.trigger, ALLOWED_TRIGGERS, '--trigger');
  validateEnum(args.status, ALLOWED_STATUSES, '--status');

  const lessonConfidence = args.lessonConfidence || 'medium';
  validateEnum(lessonConfidence, ALLOWED_LESSON_CONFIDENCE, '--lesson-confidence');
  args.gaps.forEach((gap) => validateEnum(gap, ALLOWED_GAPS, '--gap'));

  const batchId = args.batchId || config.batchId;
  const student = args.studentId || config.studentId || (batchId === 'batch-1' ? machineIdentity() : null);
  validateRequired(student, '--student-id or config.student_id');
  const lessonPath = args.lessonPath || args.path || null;
  const assignmentPath = args.assignmentPath || args.path || null;
  const inferred = inferPosition(lessonPath, assignmentPath);

  const month = bounded(args.month ?? inferred.month, 1, 12, 'month');
  const week = bounded(args.week ?? inferred.week, 1, 5, 'week');
  const day = bounded(args.day ?? inferred.day, 1, 7, 'day');

  return {
    batchId,
    projectId: args.projectId || config.projectId,
    studentId: student,
    studentName: args.studentName || config.studentName || student,
    reportDate: args.reportDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    month,
    week,
    day,
    lessonPath,
    assignmentPath,
    lessonConfidence,
    understandingStatus: args.status,
    progressScore: bounded(args.progress, 0, 100, 'progress'),
    confidenceScore: bounded(args.confidence, 0, 100, 'confidence'),
    gapCategories: [...new Set(args.gaps)],
    summary: String(args.summary).trim(),
    likelyCauses: args.causes,
    recommendedTutorAction: String(args.action).trim(),
    repeatedTopicSignals: bounded(args.repeated ?? 1, 0, 20, 'repeated'),
    triggerReason: args.trigger,
  };
}

function validateRequired(value, name) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`${name} is required.`);
  }
}

function validateEnum(value, allowed, name) {
  if (!allowed.has(value)) {
    throw new Error(`${name} must be one of: ${Array.from(allowed).join(', ')}.`);
  }
}

function machineIdentity() {
  return (process.env.USERNAME || process.env.USER || path.basename(os.homedir())).trim();
}

function inferPosition(...parts) {
  const joined = parts.filter(Boolean).join(' / ');
  if (!joined) {
    return { month: null, week: null, day: null };
  }

  const monthMatch = joined.match(/month[\s_-]*(\d+)/i);
  const weekMatch = joined.match(/week[\s_-]*(\d+)/i);
  const dayMatch = joined.match(/day[\s_-]*(\d+)/i);

  return {
    month: monthMatch ? Number(monthMatch[1]) : null,
    week: weekMatch ? Number(weekMatch[1]) : null,
    day: dayMatch ? Number(dayMatch[1]) : null,
  };
}

function bounded(value, min, max, fieldName) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    throw new Error(`Could not infer course ${fieldName}. Pass --${fieldName} or provide a path containing Month/Week/Day.`);
  }
  const numeric = Number(value);
  if (numeric < min || numeric > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}.`);
  }
  return numeric;
}

function appendExport(config, payload, response, error) {
  fs.mkdirSync(config.exportDir, { recursive: true });
  const exportPath = path.join(config.exportDir, `${payload.reportDate}.jsonl`);
  const record = {
    timestamp: new Date().toISOString(),
    payload,
    response,
    error,
  };
  fs.appendFileSync(exportPath, `${JSON.stringify(record)}\n`, 'utf8');
}

function postPayload(config, payload) {
  const endpoint = new URL(config.endpoint);
  const transport = endpoint.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  const options = {
    method: 'POST',
    hostname: endpoint.hostname,
    port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
    path: `${endpoint.pathname}${endpoint.search}`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'CodexTelemetryHelper/1.0',
    },
    timeout: config.timeoutSeconds * 1000,
  };

  return new Promise((resolve, reject) => {
    const request = transport.request(options, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(raw || `HTTP ${response.statusCode}`));
          return;
        }

        if (!raw.trim()) {
          resolve({ status: 'ok' });
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({ raw });
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('Telemetry request timed out.'));
    });
    request.write(body);
    request.end();
  });
}

function expandHome(value) {
  const raw = String(value);
  if (raw === '$HOME' || raw.startsWith('$HOME/')) {
    return path.join(os.homedir(), raw.slice(6));
  }
  if (raw === '~' || raw.startsWith('~/')) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return raw;
}
