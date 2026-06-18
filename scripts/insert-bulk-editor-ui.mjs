import fs from 'fs';

const modalPath = 'c:/Users/alvar/Opaloats/components/BulkProcessEditorModal.tsx';
const insertPath = 'c:/Users/alvar/Opaloats/scripts/bulk-editor-insert.txt';

let s = fs.readFileSync(modalPath, 'utf8');
const ins = fs.readFileSync(insertPath, 'utf8');

if (s.includes('Imagen del proceso')) {
    console.log('already inserted');
    process.exit(0);
}

const idx = s.indexOf('Etapas del Proceso *');
if (idx === -1) {
    console.error('marker not found');
    process.exit(1);
}

const blockStart = s.lastIndexOf('<div>', idx);
const before = s.slice(0, blockStart);
const after = s.slice(idx);
const etapasDivInAfter = after.indexOf('<div>');
const realAfter = etapasDivInAfter >= 0 ? after.slice(etapasDivInAfter) : after;

s = before + ins + realAfter;
fs.writeFileSync(modalPath, s);
console.log('done');
