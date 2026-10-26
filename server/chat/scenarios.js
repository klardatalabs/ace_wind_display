export function windSpeedScenario(question) {
  const match = String(question).match(/\b(\d{1,2})\s*%\s*(?:faster|higher|increase)/i);
  if (!match || !/\bwind\b/i.test(question)) return null;
  const change = Number(match[1]);
  const availablePower = Math.round((((1 + change / 100) ** 3) - 1) * 100);
  const ratio = (1 + change / 100) ** 3;
  return `Here's the calculation: available wind power is proportional to wind speed cubed when air density and rotor area stay the same (P = ½ρAv³). With ${change}% faster wind, the speed multiplier is ${1 + change / 100}, so the power multiplier is ${ratio.toFixed(3)}. That is about ${availablePower}% more power *in the wind*.\n\nThis is a hypothetical calculation, not an ACE reading or a prediction of electrical output. The turbine's power curve, controls and rated limit change the actual result. [Formula: U.S. Department of Energy Small Wind Guidebook](https://www.energy.gov/cmei/systems/windexchange/small-wind-guidebook).`;
}
