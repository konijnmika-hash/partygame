// Team colours and names shared by the lobby, results and team minigames.
export const TEAM_COLORS = ['#FF4F5F', '#3DA9FC', '#34CF78'];
export const TEAM_NAMES = ['Red', 'Blue', 'Green'];

export function teamColor(t: number | null | undefined): string | undefined {
  return t == null ? undefined : TEAM_COLORS[t % TEAM_COLORS.length];
}

export function teamName(t: number): string {
  return TEAM_NAMES[t % TEAM_NAMES.length];
}
