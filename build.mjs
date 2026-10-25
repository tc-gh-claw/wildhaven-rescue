// Optional developer tool; the generated standalone game is already included.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { build } = await import(process.env.BUILD_TOOL_MODULE || 'esbuild');
const root=path.dirname(fileURLToPath(import.meta.url));
const result=await build({entryPoints:[path.join(root,'src/main.js')],bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'inline'});
const css=await readFile(path.join(root,'style.css'),'utf8');
const license=await readFile(path.join(root,'vendor/THREE-LICENSE.txt'),'utf8');
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace('<!doctype html>',()=>`<!doctype html>\n<!-- Bundled Three.js license:\n${license.replace(/-->/g,'-- >')}\n-->`);
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`)
 .replace('<script type="module" src="./src/main.js"></script>',()=>`<script>${result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`)
 .replace('href="./"','href="#"');
await writeFile(path.join(root,'Play Wildhaven.html'),html);
await mkdir(path.join(root,'docs'),{recursive:true});
await writeFile(path.join(root,'docs/index.html'),html);
await writeFile(path.join(root,'docs/.nojekyll'),'');
console.log('Built Play Wildhaven.html — self-contained; open directly in a browser.');
console.log('GitHub Pages files are ready in docs/.');
