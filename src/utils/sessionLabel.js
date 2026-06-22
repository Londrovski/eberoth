// Shared label for a session / prequel row.
// Origin & flashback entries (kind set) show just their title — no number.
// Numbered campaign sessions show "Session N - Title".
export function sessionLabel(s) {
  if (!s) return '';
  if (s.kind) return s.title || '';
  return 'Session ' + s.number + (s.title ? ' - ' + s.title : '');
}
