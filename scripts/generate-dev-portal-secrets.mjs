import { randomBytes, scryptSync } from 'node:crypto';
import readline from 'node:readline';

// Run interactively on a trusted terminal; never commit or share the output.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  process.stderr.write('A private interactive terminal is required.\n');
  process.exit(1);
}

function readSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const listener = (text, key) => {
      if (key?.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(1);
      }
      if (key?.name === 'return' || key?.name === 'enter') {
        process.stdin.off('keypress', listener);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(value);
      } else if (key?.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key?.ctrl && !key?.meta && text >= ' ') value += text;
    };
    process.stdin.on('keypress', listener);
  });
}

const password = await readSecret('New admin password (not echoed; 16+ characters): ');
const confirmation = await readSecret('Confirm password: ');
if (password.length < 16 || password.length > 256 || password !== confirmation) {
  process.stderr.write('Password must match and contain 16–256 characters.\n');
  process.exit(1);
}
const salt = randomBytes(16);
const digest = scryptSync(password, salt, 64);
process.stdout.write('\nStore these values privately in your server secret store / local environment. Never commit or share them:\n');
process.stdout.write(`DEV_PORTAL_PASSWORD_HASH=scrypt:${salt.toString('hex')}:${digest.toString('hex')}\n`);
process.stdout.write(`DEV_PORTAL_SESSION_SECRET=${randomBytes(32).toString('hex')}\n`);
