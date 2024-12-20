const fs = require('fs');
const path = require('path');

const directories = [
    'src',
    'src/config',
    'src/commands',
    'src/events',
    'src/features',
    'src/handlers',
    'src/utils'
];

const files = [
    'src/config/config.js',
    'src/commands/index.js',
    'src/events/ready.js',
    'src/events/interactionCreate.js',
    'src/handlers/eventHandler.js',
    'src/handlers/commandHandler.js',
    'src/utils/database.js',
    'src/utils/embedUtils.js',
    'src/utils/pagination.js',
    'src/utils/translation.js',
    'src/features/pupsFeatures.js',
    'src/features/pugsFeatures.js',
    'src/features/premiumFeatures.js',
    'src/features/translationBlacklist.js',
    'src/features/ticketHandlers.js',
    'src/features/booster.js',
    'src/index.js'
];

// Create directories
directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    } else {
        console.log(`Directory already exists: ${dirPath}`);
    }
});

// Create files
files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
        console.log(`Created file: ${filePath}`);
    } else {
        console.log(`File already exists: ${filePath}`);
    }
});
