import { fileURLToPath } from 'node:url';

// npm can start Node with an uppercase Windows drive while ESM uses lowercase.
// Normalize before loading Vite so its HTML cache and module IDs use one path.
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/^[A-Z]:/,drive=>drive.toLowerCase());
process.chdir(root);
const { build }=await import('vite');
await build({root,configFile:false,resolve:{dedupe:['three'],preserveSymlinks:true}});
