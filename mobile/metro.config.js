const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the root convex/ directory so imports like @/convex/* resolve at runtime
config.watchFolders = [path.resolve(monorepoRoot, 'convex')];

// When resolving modules from the root convex/ dir, look in mobile/node_modules
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
