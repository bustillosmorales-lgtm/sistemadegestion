module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'pages/api/**/*.js',
    'lib/**/*.js',
    '!**/*.config.js',
    '!**/node_modules/**',
    '!lib/adminAuth.js',  // Excluir archivos React/JSX
    '!lib/routeObfuscator.js',
    '!lib/securityMonitor.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/components/',
    '/pages/(?!api)',  // Excluir páginas pero no API routes
    'adminAuth.js'
  ],
  // Transform settings for Next.js
  transform: {},
  moduleFileExtensions: ['js', 'jsx', 'json'],
  testTimeout: 30000 // 30 seconds for integration tests
};
