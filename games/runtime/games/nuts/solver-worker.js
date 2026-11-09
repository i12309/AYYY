'use strict';
importScripts('puzzles.js','logic.js');
onmessage = event => {
  const { id, state } = event.data;
  try { postMessage({id, answer: NutsRules.solve(state,75000)}); }
  catch (_) { postMessage({id, answer: null}); }
};
