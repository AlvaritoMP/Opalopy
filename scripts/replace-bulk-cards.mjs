import fs from 'fs';
const p = 'c:/Users/alvar/Opaloats/components/BulkProcessesView.tsx';
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('{bulkProcesses.map(p => (');
const end = s.indexOf('                                ))}', start) + '                                ))}'.length;
if (start === -1 || end === -1) {
    console.error('block not found', start, end);
    process.exit(1);
}

const replacement = `{bulkProcesses.map(p => (
                                    <BulkProcessCard
                                        key={p.id}
                                        process={p}
                                        attachmentCount={attachmentCounts[p.id] ?? p.attachments?.length ?? 0}
                                        onSelect={() => setSelectedProcess(p.id)}
                                        onEdit={() => handleEditProcess(p)}
                                        onDelete={() => handleDeleteProcess(p.id)}
                                        onDocuments={() => {
                                            setDocsModalProcess(p);
                                            setShowProcessDocsModal(true);
                                        }}
                                    />
                                ))}`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(p, s);
console.log('replaced cards');
