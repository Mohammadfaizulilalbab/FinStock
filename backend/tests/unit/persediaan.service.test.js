// ============================================================================
// UNIT TESTING: Persediaan Service (Feature 7: Persediaan) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Test Double Types:
//   1. Stub Object: Meniru data bahan baku dan kembalian database
//   2. Mock Object: Memverifikasi pencatatan logAktivitas saat penambahan bahan baku baru
//   3. Spy Object / Direct Logic: Menguji fungsi klasifikasi hitungStatusStok (AMAN, KRITIS, HABIS)
// ============================================================================

const persediaanService = require('../../src/modules/persediaan/persediaan.service');
const prisma = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({
  persediaan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  logAktivitas: {
    create: jest.fn(),
  },
}));

describe('White-Box Unit Testing: Feature 7 - Persediaan (persediaan.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-INV-01 [Logic]: hitungStatusStok menghitung status AMAN, KRITIS, dan HABIS dengan presisi', () => {
    // Branch 1: stok <= 0 -> HABIS
    expect(persediaanService.hitungStatusStok(0, 10)).toBe('HABIS');
    expect(persediaanService.hitungStatusStok(-5, 10)).toBe('HABIS');

    // Branch 2: stok <= min -> KRITIS
    expect(persediaanService.hitungStatusStok(5, 10)).toBe('KRITIS');
    expect(persediaanService.hitungStatusStok(10, 10)).toBe('KRITIS');

    // Branch 3: stok > min -> AMAN
    expect(persediaanService.hitungStatusStok(50, 10)).toBe('AMAN');
  });

  test('TC-INV-02 [Negative]: getById melempar error 404 STOCK_NOT_FOUND jika bahan baku tidak ditemukan', async () => {
    // 1. Arrange (Stub: null)
    prisma.persediaan.findUnique.mockResolvedValue(null);

    // 2. Act & 3. Assert
    await expect(persediaanService.getById(99)).rejects.toEqual({
      status: 404,
      message: 'Bahan baku tidak ditemukan',
      code: 'STOCK_NOT_FOUND',
    });
  });

  test('TC-INV-03 [Positive]: create otomatis menghitung status stok dan mencatat logAktivitas jika userId disertakan', async () => {
    // 1. Arrange
    const inputData = {
      namaBahan: 'Beras Pandan Wangi',
      kategori: 'BAHAN_BAKU',
      stok: 100,
      satuan: 'kg',
      stokMinimum: 20,
      hargaSatuan: 14000,
    };
    prisma.persediaan.create.mockResolvedValue({
      id: 5,
      ...inputData,
      status: 'AMAN',
    });
    prisma.logAktivitas.create.mockResolvedValue({ id: 1 });

    // 2. Act
    const result = await persediaanService.create(inputData, 1);

    // 3. Assert
    expect(result.status).toBe('AMAN');
    expect(prisma.persediaan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'AMAN', namaBahan: 'Beras Pandan Wangi' })
    });
    // Mock check: audit log dicatat
    expect(prisma.logAktivitas.create).toHaveBeenCalledWith({
      data: {
        penggunaId: 1,
        aksi: '[PERSEDIAAN] Menambah bahan baku baru: Beras Pandan Wangi',
      }
    });
  });
});
