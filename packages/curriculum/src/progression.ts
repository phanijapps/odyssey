/** Validates the agent's bounded difficulty recommendation. */
export function acceptNextLevel(
  _currentLevel: number,
  _recommendedLevel: number,
): number {
  if (
    !Number.isInteger(_currentLevel) ||
    !Number.isInteger(_recommendedLevel) ||
    Math.abs(_recommendedLevel - _currentLevel) > 1 ||
    _recommendedLevel < 1
  )
    throw new Error("Invalid level recommendation");
  return _recommendedLevel;
}
