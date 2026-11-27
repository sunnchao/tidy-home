#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.join(ROOT, 'minigame');

function fail(message) {
  console.error(`\n[devtools] ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const projectConfig = readJson(path.join(PROJECT, 'project.config.json'));
if (!projectConfig) {
  fail('未找到 minigame/project.config.json，请先执行 npm run build:minigame。');
}

const appid = String(projectConfig.appid || '').trim();
if (!appid || appid === 'touristappid') {
  fail(
    '当前 AppID 仍是 touristappid。微信开发者工具会拒绝它并退化成轻量窗口，模拟器不会转发点击。\n' +
      '请先在开发者工具中：扫码登录 → 小游戏 → 导入项目 → 使用「测试号」创建，\n' +
      '或在 minigame/project.config.json 中填入有效的小游戏 AppID，然后重新运行本命令。'
  );
}

function findMcpConfig() {
  const explicit = process.env.WECHAT_DEVTOOLS_MCP_CONFIG;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const roots = [
    path.join(os.homedir(), 'Library/Application Support/微信开发者工具'),
    path.join(os.homedir(), 'AppData/Roaming/微信开发者工具'),
    path.join(os.homedir(), '.config/微信开发者工具'),
  ];
  const candidates = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      candidates.push(path.join(root, entry.name, 'Default/mcp.json'));
    }
  }
  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function findWechatideBinary(command) {
  if (command && path.isAbsolute(command) && fs.existsSync(command)) return command;
  const explicit = process.env.WECHAT_DEVTOOLS_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const appRoots = [
    '/Applications',
    path.join(os.homedir(), 'Applications'),
    '/Volumes/T7 Mac/Applications',
  ];
  const bundleNames = ['wechatwebdevtools.app', '微信开发者工具.app'];
  for (const appRoot of appRoots) {
    for (const bundleName of bundleNames) {
      const binary = path.join(appRoot, bundleName, 'Contents/MacOS/wechatide');
      if (fs.existsSync(binary)) return binary;
    }
  }
  return command || 'wechatide';
}

class McpClient {
  constructor(child) {
    this.child = child;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    child.stdout.on('data', (chunk) => this.consume(chunk.toString()));
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (/error|fail|exception/i.test(text)) process.stderr.write(text);
    });
    child.on('exit', (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`devtools MCP exited with code ${code}`));
      }
      this.pending.clear();
    });
  }

  consume(text) {
    this.buffer += text;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (!message.id || !this.pending.has(message.id)) continue;
      const { resolve, reject, timer } = this.pending.get(message.id);
      clearTimeout(timer);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolve(message.result);
    }
  }

  request(method, params = {}, timeoutMs = 30_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }
}

function parseToolResult(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find((item) => item.type === 'text')?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

const mcpConfigPath = findMcpConfig();
if (!mcpConfigPath) {
  fail(
    '未找到微信开发者工具的 MCP 配置。请先打开微信开发者工具并登录，\n' +
      '然后确认 ~/Library/Application Support/微信开发者工具/*/Default/mcp.json 存在。'
  );
}

const mcpConfig = readJson(mcpConfigPath);
const server = mcpConfig?.mcpServers?.['wechat-devtools'];
if (!server) fail(`MCP 配置中缺少 wechat-devtools：${mcpConfigPath}`);

const binary = findWechatideBinary(server.command);
const child = spawn(binary, server.args || [], { stdio: ['pipe', 'pipe', 'pipe'] });
const client = new McpClient(child);

try {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const openFullMode = async () => {
    const result = await client.request('tools/call', {
      name: 'open_project_window',
      arguments: { project: PROJECT, windowMode: 'fullMode' },
    });
    return parseToolResult(result);
  };
  const canScreenshot = async () => {
    const result = await client.request('tools/call', {
      name: 'simulator_screenshot',
      arguments: { project: PROJECT },
    });
    return parseToolResult(result)?.success === true;
  };

  await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'tidy-home-devtools', version: '1.0.0' },
  });
  client.notify('notifications/initialized');

  await client
    .request('tools/call', {
      name: 'close_project_window',
      arguments: { project: PROJECT },
    })
    .catch(() => {
      // The project window may not be open yet.
    });

  // Window close is asynchronous; opening immediately can reuse the closing window id.
  await delay(2200);

  let parsed = await openFullMode();
  if (parsed?.success === false) {
    const code = parsed.code ? `${parsed.code}: ` : '';
    fail(
      `${code}${parsed.error || '打开项目失败'}\n` +
        '请确认已在开发者工具中登录，并用「测试号」或有效小游戏 AppID 导入该项目。'
    );
  }

  let verified = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await delay(1800);
    if (await canScreenshot()) {
      verified = true;
      break;
    }
    parsed = await openFullMode();
    if (parsed?.success === false) break;
  }
  if (!verified) {
    fail(
      '项目窗口没有成功重新打开。请从开发者工具的项目列表双击本项目，再重试 npm run devtools。'
    );
  }

  console.log(`[devtools] 已用 fullMode 打开：${PROJECT}`);
  console.log(`[devtools] AppID：${appid}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  child.kill();
}
