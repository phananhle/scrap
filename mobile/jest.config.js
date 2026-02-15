module.exports = {
  testEnvironment: 'node',
  watchman: false,
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js|jsx)', '**/*.test.(ts|tsx|js|jsx)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/api/(.*)$': '<rootDir>/src/api/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@react-native|react-native)/)'],
};
