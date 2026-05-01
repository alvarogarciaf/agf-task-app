const fs = require('fs');
const path = require('path');

const mockDataPath = path.join(__dirname, 'lib', 'mock-data.ts');
let content = fs.readFileSync(mockDataPath, 'utf8');

// Add urgencies array
const urgenciesArr = `export const urgencies: UrgencyLevel[] = [
  { id: "u_highest", name: "Highest", color: "oklch(0.6 0.25 25)", order: 0 },
  { id: "u_high", name: "High", color: "oklch(0.65 0.2 40)", order: 1 },
  { id: "u_medium", name: "Medium", color: "oklch(0.7 0.15 250)", order: 2 },
  { id: "u_low", name: "Low", color: "oklch(0.8 0 0)", order: 3 },
];\n\n`;

content = content.replace('export const projects', urgenciesArr + 'export const projects');

// Fix imports
content = content.replace('import type { Task, Project, Person, Context } from "./types"', 'import type { Task, Project, Person, Context, UrgencyLevel } from "./types"');

// Replace urgency with urgency_id
content = content.replace(/urgency: "Highest"/g, 'urgency_id: "u_highest"');
content = content.replace(/urgency: "High"/g, 'urgency_id: "u_high"');
content = content.replace(/urgency: "Medium"/g, 'urgency_id: "u_medium"');
content = content.replace(/urgency: "Low"/g, 'urgency_id: "u_low"');

fs.writeFileSync(mockDataPath, content);
console.log('mock-data.ts updated!');
