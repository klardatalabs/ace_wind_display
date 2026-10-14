// Retrieval quality check for the knowledge base: learner questions, each with the section
// headings that answer it in the ingested books. Reports recall@5 and MRR for keyword-only,
// vector-only and hybrid search, so changes to chunking, models or fusion can be measured.
//
//   node server/knowledge/eval/retrievalEval.mjs

import { config } from "../../config/index.js";
import { closePostgres } from "../../infra/postgres.js";
import { connectRedis, closeRedis } from "../../infra/redis.js";
import { embedQuery } from "../../integrations/llm.js";
import { embeddingModel } from "../ingest.js";
import { fuse } from "../search.js";
import * as knowledge from "../../db/repositories/knowledge.js";

// [question, heading pattern of a passage that answers it]
const CASES = [
  ["What is the Betz limit and why can't a turbine extract all the energy in the wind?", /betz|actuator disc|momentum theory|maximum (power|efficiency)/i],
  ["How does pitch control limit power in strong winds?", /pitch/i],
  ["What does the yaw system of a turbine do?", /yaw/i],
  ["Why does wind speed increase with height above the ground?", /shear|vertical|height|boundary layer|logarithmic|profile/i],
  ["What is the Weibull distribution used for in wind energy?", /weibull|distribution|statistic/i],
  ["What causes a wind turbine blade to stall?", /stall/i],
  ["What is the tip speed ratio?", /tip speed ratio|tip-speed|rotor performance|power coefficient/i],
  ["How do turbine wakes affect the output of a wind farm?", /wake/i],
  ["What is the capacity factor of a wind turbine?", /capacity factor|energy (production|yield|capture)|annual energy/i],
  ["How does a doubly fed induction generator work?", /doubly|induction|variable.speed/i],
  ["What loads act on a wind turbine tower?", /tower/i],
  ["How is turbulence intensity defined?", /turbulence/i],
  ["Why do most modern wind turbines have three blades?", /number of blades|blade number|three.blade|solidity/i],
  ["What is blade element momentum theory?", /blade element|bem/i],
  ["How does a direct-drive generator differ from a geared drive train?", /direct.drive|gearbox|gear|drive train|drivetrain/i],
  ["What is a wind turbine power curve?", /power curve|power performance/i],
  ["What is the cut-in wind speed of a turbine?", /cut.in|power curve|operating|control/i],
  ["Where does wind turbine noise come from and how can it be reduced?", /noise|acoustic/i],
  ["What is fatigue loading and why does it matter for blades?", /fatigue/i],
  ["How is wind power connected to and controlled within the electricity grid?", /grid|network|power system|electrical/i],
];

const K = 5;
const heading = (row) => row.content.split("\n")[0];

function score(rankings) {
  let hits = 0;
  let reciprocal = 0;
  rankings.forEach(([pattern, rows]) => {
    const rank = rows.slice(0, K).findIndex((r) => pattern.test(heading(r)));
    if (rank >= 0) {
      hits++;
      reciprocal += 1 / (rank + 1);
    }
  });
  return { recall: hits / rankings.length, mrr: reciprocal / rankings.length };
}

await connectRedis();
try {
  const { modelId, dimensions } = await embeddingModel();
  const results = { keyword: [], vector: [], hybrid: [] };
  const misses = [];
  for (const [question, pattern] of CASES) {
    const embedding = await embedQuery(question);
    const [vector, keyword] = await Promise.all([
      knowledge.searchByVector({ modelId, dimensions, embedding, limit: 20 }),
      knowledge.searchByKeywords({ text: question, limit: 20 }),
    ]);
    const hybrid = fuse([vector, keyword], 20);
    results.vector.push([pattern, vector]);
    results.keyword.push([pattern, keyword]);
    results.hybrid.push([pattern, hybrid]);
    if (!hybrid.slice(0, K).some((r) => pattern.test(heading(r)))) misses.push(`${question}\n      got: ${hybrid.slice(0, 3).map(heading).join(" | ")}`);
  }
  console.log(`Embedding model: ${config.embeddings.model} (${dimensions} dims), ${CASES.length} questions, k=${K}`);
  for (const [mode, rankings] of Object.entries(results)) {
    const { recall, mrr } = score(rankings);
    console.log(`${mode.padEnd(8)} recall@${K} ${(recall * 100).toFixed(0).padStart(3)}%   MRR ${mrr.toFixed(3)}`);
  }
  if (misses.length) console.log(`\nHybrid misses:\n  - ${misses.join("\n  - ")}`);
} finally {
  await closeRedis();
  await closePostgres();
}
