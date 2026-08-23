const fs = require('fs');
const file = fs.readFileSync('lib/constants.ts', 'utf8');

const additionalIcons = [
  'Activity', 'Airplay', 'AlarmClock', 'AlignLeft', 'AlignRight', 'AlignCenter',
  'AlignJustify', 'Anchor', 'Aperture', 'Archive', 'ArrowRight', 'ArrowLeft',
  'ArrowUp', 'ArrowDown', 'AtSign', 'Award', 'Banknote', 'Battery', 'BatteryCharging',
  'Binary', 'Bluetooth', 'Bold', 'Bookmark', 'Box', 'Briefcase', 'Brush', 'Bug',
  'Building', 'Building2', 'Bus', 'Calculator', 'CalendarDays', 'Camera', 'Car',
  'Carrot', 'Cast', 'Check', 'CheckCircle', 'CheckSquare', 'ChevronRight', 'ChevronLeft',
  'ChevronUp', 'ChevronDown', 'Clipboard', 'Clock', 'Cloud', 'CloudLightning',
  'CloudRain', 'CloudSnow', 'Command', 'Compass', 'Contact', 'Copy', 'Cpu',
  'Crosshair', 'Crown', 'Database', 'Delete', 'Disc', 'Divide', 'Download',
  'Droplet', 'Edit', 'ExternalLink', 'EyeOff', 'FastForward', 'Feather', 'File',
  'FileDigit', 'FileSpreadsheet', 'Film', 'Filter', 'Flag', 'Flame', 'Flashlight',
  'Folder', 'FolderOpen', 'Frown', 'FunctionSquare', 'Gauge', 'Ghost', 'Gift',
  'Glasses', 'Globe', 'GraduationCap', 'Grid', 'HardDrive', 'Hash', 'Headphones',
  'HeartPulse', 'HelpCircle', 'Hexagon', 'History', 'Home', 'Image', 'Inbox',
  'Info', 'Italic', 'Key', 'Keyboard', 'Layers', 'Layout', 'LayoutDashboard',
  'Library', 'LifeBuoy', 'Link', 'Link2', 'List', 'ListMusic', 'ListOrdered',
  'Lock', 'LockOpen', 'LogOut', 'Mail', 'Map', 'MapPin', 'Maximize', 'Medal',
  'Menu', 'MessageCircle', 'MessageSquare', 'Mic', 'MicOff', 'Minimize', 'Minus',
  'Monitor', 'MonitorSpeaker', 'Moon', 'MoreHorizontal', 'MoreVertical', 'MousePointer',
  'MousePointerClick', 'MousePointer2', 'Move', 'Music', 'Navigation', 'Navigation2',
  'Network', 'Octagon', 'Package', 'Paperclip', 'Pause', 'PauseCircle', 'PenTool',
  'Percent', 'Phone', 'PhoneCall', 'PhoneForwarded', 'PhoneIncoming', 'PhoneMissed',
  'PhoneOff', 'PhoneOutgoing', 'PieChart', 'Pin', 'Play', 'PlayCircle', 'Plus',
  'PlusCircle', 'PlusSquare', 'Pocket', 'Power', 'Printer', 'Puzzle', 'QrCode',
  'Radio', 'RadioReceiver', 'RectangleHorizontal', 'RectangleVertical', 'RefreshCcw',
  'RefreshCw', 'Repeat', 'Rewind', 'RotateCcw', 'RotateCw', 'Router', 'Rss',
  'Save', 'Scale', 'Scissors', 'Search', 'Send', 'Server', 'Settings', 'Share',
  'Share2', 'Shield', 'ShieldOff', 'ShoppingBag', 'ShoppingCart', 'Shuffle',
  'Sidebar', 'SkipBack', 'SkipForward', 'Slack', 'Slash', 'Sliders', 'Smartphone',
  'Smile', 'Speaker', 'Square', 'Star', 'StopCircle', 'Sun', 'Sunrise', 'Sunset',
  'Tablet', 'Tag', 'Tags', 'Target', 'Terminal', 'Thermometer', 'ThumbsDown',
  'ThumbsUp', 'ToggleLeft', 'ToggleRight', 'Tornado', 'Trash', 'Trash2', 'TrendingDown',
  'TrendingUp', 'Triangle', 'Truck', 'Tv', 'Twitter', 'Type', 'Umbrella',
  'Underline', 'Unlock', 'Upload', 'UploadCloud', 'User', 'UserCheck', 'UserMinus',
  'UserPlus', 'UserX', 'Users', 'Video', 'VideoOff', 'Voicemail', 'Volume',
  'Volume1', 'Volume2', 'VolumeX', 'Watch', 'Wifi', 'WifiOff', 'Wind', 'X',
  'XCircle', 'XSquare', 'Youtube', 'Zap', 'ZapOff', 'ZoomIn', 'ZoomOut'
];

let importsRegex = /import\s+\{([\s\S]*?)\}\s+from\s+["']lucide-react["']/;
let importsMatch = file.match(importsRegex);
if (!importsMatch) {
  console.log('No imports found');
  process.exit(1);
}

let existingImports = importsMatch[1].split(',').map(s => s.trim()).filter(Boolean).filter(s => s !== 'type LucideIcon');
let allIcons = new Set([...existingImports, ...additionalIcons]);

// Make sure we have FolderKanban for legacy fallback
allIcons.add('FolderKanban');
// Make sure we have tag
allIcons.add('Tag');
// Ensure ListChecks and LayoutList
allIcons.add('ListChecks');
allIcons.add('LayoutList');
allIcons.add('Tags');
allIcons.add('Inbox');
allIcons.add('Star');

let newImports = Array.from(allIcons).sort().join(',\n  ');
let newImportBlock = 'import {\n  ' + newImports + ',\n  type LucideIcon,\n} from "lucide-react"';

let newIconOptions = 'export const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [\n  ' + 
  Array.from(allIcons).sort().map(name => '{ name: "' + name + '", icon: ' + name + ' }').join(',\n  ') + '\n];';

let modifiedFile = file.replace(importsRegex, newImportBlock);

// Find the export const ICON_OPTIONS block and replace it
// It goes from "export const ICON_OPTIONS" up to the next export
let iconOptionsRegex = /export const ICON_OPTIONS:.*?\];/s;
modifiedFile = modifiedFile.replace(iconOptionsRegex, newIconOptions);

fs.writeFileSync('lib/constants.ts', modifiedFile);
console.log('Done');
