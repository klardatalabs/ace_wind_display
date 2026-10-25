export function windSpeedScenario(question) {
  const match = String(question).match(/\b(\d{1,2})\s*%\s*(?:faster|higher|increase)/i);
  if (!match || !/\bwind\b/i.test(question)) return null;
  const change = Number(match[1]);
  const availablePower = Math.round((((1 + change / 100) ** 3) - 1) * 100);
  return `Assuming the same air density and steady wind, ${change}% more wind speed means about ${availablePower}% more power available in the moving air (speed cubed). This is a hypothetical calculation, not an ACE reading or a prediction of my electrical output; turbine controls and rated power limit the result.`;
}
