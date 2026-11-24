// ============================================================================
// UNIT TESTING: Pengeluaran Service (Feature 5: Pengeluaran) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Test Double Types:
//   1. Stub Object: Meniru kembalian prisma.pengeluaran.findMany & aggregate
//   2. Mock Object: Memverifikasi query filter parameter rentang tanggal & kategori
// ============================================================================

const pengeluaranService = require('../../src/modules/pengeluaran/pengeluaran.service');
const prisma = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({
  pengeluaran: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
}));

describe('White-Box Unit Testing: Feature 5 - Pengeluaran (pengeluaran.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-EXP-01 [Positive]: getAllPengeluaran memfilter dengan benar berdasarkan kategori dan tanggal', async () => {
    // 1. Arrange
    const stubPengeluaran = [
      { id: 1, keterangan: 'Beli Bahan Baku', jumlah: 150000, kategori: 'BAHAN_BAKU' }
    ];
    prisma.pengeluaran.findMany.mockResolvedValue(stubPengeluaran);

    // 2. Act
    const res = await pengeluaranService.getAllPengeluaran({
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      kategori: 'BAHAN_BAKU',
      search: 'Bahan',
    });

    // 3. Assert
    expect(res).toEqual(stubPengeluaran);
    expect(prisma.pengeluaran.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kategori: 'BAHAN_BAKU',
          keterangan: { contains: 'Bahan' }
        })
      })
    );
  });

  test('TC-EXP-02 [Positive]: getSummary menghitung total bulan ini, bulan lalu, dan kategori terbesar', async () => {
    // 1. Arrange
    prisma.pengeluaran.aggregate
      .mockResolvedValueOnce({ _sum: { jumlah: 500000 } }) // this month
      .mockResolvedValueOnce({ _sum: { jumlah: 300000 } }); // last month
    prisma.pengeluaran.groupBy.mockResolvedValueOnce([
      { kategori: 'OPERASIONAL', _sum: { jumlah: 250000 } }
    ]);

    // 2. Act
    const summary = await pengeluaranService.getSummary();

    // 3. Assert
    expect(summary.totalBulanIni).toBe(500000);
    expect(summary.totalBulanLalu).toBe(300000);
    expect(summary.kategoriTerbesar).toEqual({ kategori: 'OPERASIONAL', jumlah: 250000 });
  });

  test('TC-EXP-03 [Positive]: getSummary menangani data agregasi kosong dengan aman', async () => {
    // 1. Arrange
    prisma.pengeluaran.aggregate
      .mockResolvedValueOnce({ _sum: { jumlah: null } })
      .mockResolvedValueOnce({ _sum: { jumlah: null } });
    prisma.pengeluaran.groupBy.mockResolvedValueOnce([]);

    // 2. Act
    const summary = await pengeluaranService.getSummary();

    // 3. Assert
    expect(summary.totalBulanIni).toBe(0);
    expect(summary.totalBulanLalu).toBe(0);
    expect(summary.kategoriTerbesar).toEqual({ kategori: '-', jumlah: 0 });
  });
});
