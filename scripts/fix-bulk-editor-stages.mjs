import fs from 'fs';

const modalPath = 'c:/Users/alvar/Opaloats/components/BulkProcessEditorModal.tsx';
const blockPath = 'c:/Users/alvar/Opaloats/scripts/fix-stages-block.txt';

let s = fs.readFileSync(modalPath, 'utf8');
const block = fs.readFileSync(blockPath, 'utf8');

const etapasIdx = s.indexOf('Etapas del Proceso *');
const start = s.lastIndexOf('<div>', etapasIdx);
const endIdx = s.indexOf('                    ) : (', etapasIdx);

if (start === -1 || endIdx === -1) {
    console.error('bounds', start, endIdx);
    process.exit(1);
}

s = s.slice(0, start) + block + '\n' + s.slice(endIdx);
fs.writeFileSync(modalPath, s);
console.log('fixed');
