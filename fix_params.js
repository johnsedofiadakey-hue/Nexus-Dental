const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('route.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src/app/api');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('params: { id: string }') || content.includes('params: { id?: string }')) {
    content = content.replace(/\{ params \}: \{ params: \{ id: string \} \}/g, '{ params }: { params: Promise<{ id: string }> }');
    content = content.replace(/\{ params \}: \{ params: \{ id\?: string \} \}/g, '{ params }: { params: Promise<{ id?: string }> }');
    content = content.replace(/const patientId = params\.id;/g, 'const patientId = (await params).id;');
    content = content.replace(/const id = params\.id;/g, 'const id = (await params).id;');
    content = content.replace(/params\.id/g, '(await params).id');
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
