const fs = require('fs');
const path = './components/app-content.tsx';
let content = fs.readFileSync(path, 'utf8');

const handlers = [
  'handleCreateTask',
  'handleCreateNote',
  'handleDeleteAllTasks',
  'handleAddProject',
  'handleUpdateProject',
  'handleDeleteProject',
  'handleAddTag',
  'handleUpdateTag',
  'handleDeleteTag',
  'handleAddPerson',
  'handleUpdatePerson',
  'handleDeletePerson',
  'handleAddContext',
  'handleUpdateContext',
  'handleDeleteContext',
  'handleAddUrgency',
  'handleUpdateUrgency',
  'handleDeleteUrgency',
  'handleNuke',
  'handleSaveView',
  'handleDeleteSavedView'
];

handlers.forEach(h => {
  const regex = new RegExp(\const \ = async \\\\((.*?)\\\\) => {\\\\s+\, 'g');
  content = content.replace(regex, \const \ = async () => {\\n    if (!db) return as any;\\n    \);
  
  const regex2 = new RegExp(\const \ = useCallback\\\\(async \\\\((.*?)\\\\) => {\\\\s+\, 'g');
  content = content.replace(regex2, \const \ = useCallback(async () => {\\n    if (!db) return as any;\\n    \);
});

fs.writeFileSync(path, content);
