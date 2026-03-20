import fs from 'fs';

const filePath = 'src/components/Dashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/bg-blue-50/g, 'bg-neutral-50');
content = content.replace(/bg-blue-100/g, 'bg-neutral-100');
content = content.replace(/bg-blue-600/g, 'bg-neutral-900');
content = content.replace(/text-blue-50/g, 'text-neutral-50');
content = content.replace(/text-blue-100/g, 'text-neutral-100');
content = content.replace(/text-blue-600/g, 'text-neutral-900');
content = content.replace(/text-blue-700/g, 'text-neutral-800');
content = content.replace(/from-blue-600/g, 'from-neutral-800');
content = content.replace(/to-blue-700/g, 'to-neutral-900');
content = content.replace(/shadow-blue-200/g, 'shadow-neutral-200');
content = content.replace(/border-blue-200/g, 'border-neutral-200');
content = content.replace(/#2563eb/g, '#171717');
content = content.replace(/#60a5fa/g, '#525252');
content = content.replace(/#93c5fd/g, '#a3a3a3');
content = content.replace(/#bfdbfe/g, '#d4d4d4');
content = content.replace(/#0ea5e9/g, '#eab308');
content = content.replace(/#ef4444/g, '#eab308');
content = content.replace(/#f97316/g, '#eab308');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced colors successfully.');
