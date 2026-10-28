// A small, honest local demonstration. It never contacts or writes to the live chat service.
export function previewAnswer(question) {
  if (/\b(power curve)\b/i.test(question)) return "A power curve plots electrical output against wind speed. Output generally climbs with wind speed, then controls hold it near rated power. This local preview cannot calculate ACE's measured curve; the production chat needs its history database for that.";
  if (/\b(direct.drive|gearbox|drivetrain)\b/i.test(question)) return "A direct-drive turbine couples the rotor to a large generator without a gearbox. Open Library for the reference turbine reports and patent documents. This preview does not claim those documents describe ACE's exact equipment.";
  if (/\b(patent|paper|research|book)\b/i.test(question)) return "Open Library at the top left for linked books, papers and patents. This local preview has no research database, so I cannot search passages or give a source-backed answer yet.";
  return "This is a limited local chat preview. Try ‘Explain the power curve’ or open Library. Full live and research answers need the production chat and knowledge databases.";
}
