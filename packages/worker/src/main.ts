import { readCommand } from './command.ts';

// The one entry point of the worker. A usage fault gives 2, as each sub-command does.
const command = readCommand(process.argv.slice(2));
if (command.kind === 'usage') {
  console.error(command.text);
  process.exitCode = 2;
} else {
  const subCommand = await command.load();
  process.exitCode = await subCommand(command.args);
}
