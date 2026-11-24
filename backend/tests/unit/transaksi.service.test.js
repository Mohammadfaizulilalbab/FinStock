// ============================================================================
// UNIT TESTING: Transaksi Service (Feature 4: Transaksi) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Test Double Types:
//   1. Stub Object: Meniru kembalian prisma.transaksi.findFirst & prisma.transaksi.findMany
//   2. Mock Object: Memverifikasi interaksi pemanggilan generateKodeTransaksi & prisma.$transaction
// ============================================================================

const transaksiService = require('../../src/modules/transaksi/transaksi.service');
const prisma = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({
  transaksi: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
}));

describe('White-Box Unit Testing: Feature 4 - Transaksi (transaksi.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-TRX-01 [Positive]: generateKodeTransaksi harus menghasilkan #T-0001 jika belum ada transaksi', async () => {
    // 1. Arrange (Stub: null)
    prisma.transaksi.findFirst.mockResolvedValue(null);

    // 2. Act
    const kode = await transaksiService.generateKodeTransaksi();

    // 3. Assert
    expect(kode).toBe('#T-0001');
    expect(prisma.transaksi.findFirst).toHaveBeenCalledWith({ orderBy: { id: 'desc' } });
  });

  test('TC-TRX-02 [Positive]: generateKodeTransaksi harus menambah urutan jika transaksi terakhir ada', async () => {
    // 1. Arrange (Stub: #T-0009)
    prisma.transaksi.findFirst.mockResolvedValue({ id: 9, kodeTransaksi: '#T-0009' });

    // 2. Act
    const kode = await transaksiService.generateKodeTransaksi();

    // 3. Assert
    expect(kode).toBe('#T-0010');
  });

  test('TC-TRX-03 [Negative]: getById melempar error 404 jika transaksi tidak ditemukan', async () => {
    // 1. Arrange (Stub: null)
    prisma.transaksi.findUnique.mockResolvedValue(null);

    // 2. Act & 3. Assert
    await expect(transaksiService.getById(999)).rejects.toEqual({
      status: 404,
      message: 'Transaksi tidak ditemukan',
      code: 'TRANSACTION_NOT_FOUND',
    });
  });

  test('TC-TRX-04 [Positive]: getAll berhasil memfilter transaksi berdasarkan kasirId dan status', async () => {
    // 1. Arrange
    const stubList = [
      { id: 1, kodeTransaksi: '#T-0001', total: 25000, status: 'SELESAI', kasirId: 2 }
    ];
    prisma.transaksi.findMany.mockResolvedValue(stubList);
    prisma.transaksi.count.mockResolvedValue(1);

    // 2. Act
    const res = await transaksiService.getAll({ page: 1, limit: 10, status: 'SELESAI', kasirId: '2' });

    // 3. Assert
    expect(res.data).toEqual(stubList);
    expect(res.pagination.total).toBe(1);
    expect(prisma.transaksi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SELESAI', kasirId: 2 })
      })
    );
  });
});
