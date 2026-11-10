/* Rebuild the LGPL browser reader as an independent ES module. */
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints:[path.join(here,'src/index.ts')],
  outfile:path.join(here,'mpxj.mjs'),
  bundle:true,
  format:'esm',
  platform:'neutral',
  target:'es2022',
  minify:true,
  legalComments:'inline',
  banner:{js:'/*! mpxj-ts: Microsoft Project file reader, a port of MPXJ (https://github.com/joniles/mpxj). LGPL-2.1-or-later. Source: https://johnmcm.com/source/mpxj/ */'}
});
console.log('Wrote '+path.join(here,'mpxj.mjs')+' ('+fs.statSync(path.join(here,'mpxj.mjs')).size+' bytes)');
