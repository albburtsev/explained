export interface LearnerContentRecord {
  path: string;
  markdown: string;
}

interface NonMacosSetupRule {
  description: string;
  pattern: RegExp;
}

const nonMacosName =
  String.raw`(?:windows|linux|ubuntu|debian|fedora|centos|red[ -]hat|rhel|arch(?:[ -]linux)?|alpine|freebsd|chrome[ -]?os)`;
const setupTerm = String.raw`(?:install(?:ation|er|ing)?|upgrad(?:e|ing)|configur(?:e|ation|ing)|setup|set[ -]up)`;

const nonMacosSetupRules: NonMacosSetupRule[] = [
  {
    description: 'non-macOS setup heading',
    pattern: new RegExp(
      String.raw`^\s{0,3}#{1,6}\s+.*(?:\b${nonMacosName}\b.*\b${setupTerm}\b|\b${setupTerm}\b.*\b${nonMacosName}\b)`,
      'i',
    ),
  },
  {
    description: 'non-macOS setup alternative',
    pattern: new RegExp(
      String.raw`^\s*[-*+]\s+(?=[^:\n]{0,80}:)(?=[^:\n]*\b${nonMacosName}\b)[^:\n]+:\s*(?:.*\b(?:install|installer|download|configure|configuration|setup|run|use|open|path|file|directory|folder|package[ -]manager)\b.*|.*(?:~\/|\$HOME\/|[a-z]:[\\/]).*)`,
      'i',
    ),
  },
  {
    description: 'Linux package-manager command',
    pattern:
      /\b(?:sudo\s+)?(?:apt(?:-get)?\s+(?:install|update|upgrade)|dnf\s+(?:install|update|upgrade)|yum\s+(?:install|update|upgrade)|pacman\s+(?:-[a-z]*s|--sync)|zypper\s+(?:install|update)|apk\s+(?:add|update|upgrade))\b/i,
  },
  {
    description: 'Windows package-manager command',
    pattern: /\b(?:winget|choco(?:latey)?|scoop)\s+(?:install|upgrade)\b/i,
  },
  {
    description: 'Linux-specific configuration command',
    pattern:
      /\b(?:systemctl\s+(?:enable|start|restart|edit)|update-alternatives\s+--(?:install|config|set)|gsettings\s+set)\b/i,
  },
  {
    description: 'Windows-specific configuration path',
    pattern:
      /(?:\b[a-z]:[\\/](?:users|program files|programdata|windows)(?:[\\/]|\b)|%[a-z_][a-z0-9_]*%[\\/]|(?:\$HOME|~)\/(?:_vimrc|vimfiles)(?:\/|\b))/i,
  },
  {
    description: 'Windows-specific configuration interface',
    pattern:
      /(?:\b(?:open|launch|run|start|click|select|choose|type|enter)\b.{0,80}\b(?:control panel|registry editor|regedit(?:\.exe)?|cmd\.exe|command prompt)\b|\b(?:control panel|registry editor|regedit(?:\.exe)?|cmd\.exe|command prompt)\b.{0,80}\b(?:open|launch|run|start|click|select|choose|type|enter)\b)/i,
  },
];

export function nonMacosSetupErrors(records: LearnerContentRecord[]): string[] {
  const errors: string[] = [];

  for (const record of records.toSorted((left, right) => left.path.localeCompare(right.path))) {
    const lines = record.markdown.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      const matchedRule = nonMacosSetupRules.find((rule) => rule.pattern.test(line));
      if (matchedRule === undefined) continue;

      errors.push(`${record.path}:${index + 1}: ${matchedRule.description}`);
    }
  }

  return errors;
}

export function assertMacosOnlySetup(records: LearnerContentRecord[]): void {
  const errors = nonMacosSetupErrors(records);
  if (errors.length > 0) throw new Error(`macOS-only setup validation failed:\n- ${errors.join('\n- ')}`);
}
