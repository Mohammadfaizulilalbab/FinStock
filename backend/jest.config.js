module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/modules/auth/auth.service.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true,
};
