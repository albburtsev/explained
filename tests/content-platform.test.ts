import { describe, expect, it } from 'vitest';
import {
  assertMacosOnlySetup,
  nonMacosSetupErrors,
  type LearnerContentRecord,
} from '../src/lib/content-platform';

const repositoryMarkdown: Record<string, string> = import.meta.glob<string>('../knowledge/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function record(markdown: string, path = 'knowledge/lessons/example/setup.md'): LearnerContentRecord {
  return { path, markdown };
}

function loadRepositoryLearnerContent(): LearnerContentRecord[] {
  return Object.entries(repositoryMarkdown).map(([path, markdown]) => ({
    path: path.replace(/^\.\.\//, ''),
    markdown,
  }));
}

describe('macOS-only setup validation', () => {
  it('accepts macOS and macOS-compatible platform-neutral setup guidance', () => {
    const records = [
      record('## Install Tool on macOS\n\n```sh\nbrew install tool\n```'),
      record('Install the CLI with `npm install -g example-cli`.', 'knowledge/lessons/example/npm.md'),
    ];

    expect(nonMacosSetupErrors(records)).toEqual([]);
  });

  it('accepts non-procedural references to other operating systems', () => {
    const markdown = 'Linux and Windows are operating systems with conventions that differ from macOS.';

    expect(nonMacosSetupErrors([record(markdown)])).toEqual([]);
  });

  it('reports OS-labeled setup alternatives and non-macOS package-manager commands', () => {
    const records = [
      record('## Install Tool on Windows'),
      record('- **Linux and macOS**: edit `~/.toolrc`.', 'knowledge/lessons/example/configuration.md'),
      record('Run `sudo apt install tool`.', 'knowledge/lessons/example/linux.md'),
      record('Run `winget install Example.Tool`.', 'knowledge/lessons/example/windows.md'),
    ];

    expect(nonMacosSetupErrors(records)).toEqual([
      'knowledge/lessons/example/configuration.md:1: non-macOS setup alternative',
      'knowledge/lessons/example/linux.md:1: Linux package-manager command',
      'knowledge/lessons/example/setup.md:1: non-macOS setup heading',
      'knowledge/lessons/example/windows.md:1: Windows package-manager command',
    ]);
  });

  it('reports non-macOS paths, shell commands, and graphical configuration steps', () => {
    const markdown = [
      'Create `C:\\Users\\learner\\_vimrc`.',
      'Run `cmd.exe` and enter the command.',
      'Open Control Panel and click Environment Variables.',
    ].join('\n');

    expect(nonMacosSetupErrors([record(markdown)])).toEqual([
      'knowledge/lessons/example/setup.md:1: Windows-specific configuration path',
      'knowledge/lessons/example/setup.md:2: Windows-specific configuration interface',
      'knowledge/lessons/example/setup.md:3: Windows-specific configuration interface',
    ]);
  });

  it('throws one diagnostic containing each source path', () => {
    const records = [
      record('Run `dnf install tool`.', 'knowledge/courses/example.md'),
      record('Run `scoop install tool`.', 'knowledge/lessons/example/setup.md'),
    ];

    expect(() => assertMacosOnlySetup(records)).toThrow(
      [
        'macOS-only setup validation failed:',
        '- knowledge/courses/example.md:1: Linux package-manager command',
        '- knowledge/lessons/example/setup.md:1: Windows package-manager command',
      ].join('\n'),
    );
  });
});

describe('repository macOS-only setup policy', () => {
  it('contains no unambiguous non-macOS installation or configuration alternatives', () => {
    expect(() => assertMacosOnlySetup(loadRepositoryLearnerContent())).not.toThrow();
  });
});
