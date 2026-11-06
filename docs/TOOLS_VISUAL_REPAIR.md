# Tools: restore the approved visual design

2026-11-06. Baseline: 6adbae4.

The approved concept and implemented screenshot differed materially: the previous vector tower was a flat substitute for the watercolor artwork, text became excessively small, and the chart/cost/scenario hierarchy was lost.

Checkpoint 1: preserve `tools/assets/approved-city-frame.avif`. This asset contains only the painted tower, clouds and low skyline extracted from the user-approved concept, with all interface controls, labels and numbers excluded. The central working area is empty. It is not a screenshot used as a fake interface. All controls and calculated numbers will remain real HTML/SVG.

Next checkpoints: faithful responsive card structure and legible compact typography; real calculated scenario/summary cards; browser/regression tests and deployment. No changes to loan-model.js or science-model.js are planned.
