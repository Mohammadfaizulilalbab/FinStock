module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/modules/auth/auth.service.js',
    'src/modules/transaksi/transaksi.service.js',
    'src/modules/pengeluaran/pengeluaran.service.js',
    'src/modules/menu/menu.service.js',
    'src/modules/persediaan/persediaan.service.js',
    'src/modules/vendor/vendor.service.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true,
};
