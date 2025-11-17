#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const command = 'mint-tsdocs';
const args = process.argv.slice(2);

const result = spawn(command, args, { stdio: 'inherit' });

result.on('close', (code) => {
  process.exit(code);
});
