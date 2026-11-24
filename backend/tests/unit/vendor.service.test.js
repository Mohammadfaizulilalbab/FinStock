// ============================================================================
// UNIT TESTING: Vendor Service (Feature 8: Vendor) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Test Double Types:
//   1. Stub Object: Meniru data vendor terdaftar dan hasil findMany/findUnique
//   2. Mock Object: Memverifikasi parameter yang diteruskan ke prisma.vendor.create & update
// ============================================================================

const vendorService = require('../../src/modules/vendor/vendor.service');
const prisma = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({
  vendor: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  produkVendor: {
    findMany: jest.fn(),
  },
}));

describe('White-Box Unit Testing: Feature 8 - Vendor (vendor.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-VND-01 [Negative]: getById melempar error 404 VENDOR_NOT_FOUND jika vendor tidak ada', async () => {
    // 1. Arrange (Stub: null)
    prisma.vendor.findUnique.mockResolvedValue(null);

    // 2. Act & 3. Assert
    await expect(vendorService.getById(888)).rejects.toEqual({
      status: 404,
      message: 'Vendor tidak ditemukan',
      code: 'VENDOR_NOT_FOUND',
    });
  });

  test('TC-VND-02 [Positive]: create berhasil mendaftarkan vendor baru dengan nilai default AKTIF', async () => {
    // 1. Arrange
    const newVendorInput = {
      nama: 'CV Berkah Unggas',
      telepon: '081234567890',
      email: 'berkah@unggas.com',
    };
    prisma.vendor.create.mockResolvedValue({
      id: 1,
      ...newVendorInput,
      alamat: null,
      catatan: null,
      status: 'AKTIF',
    });

    // 2. Act
    const res = await vendorService.create(newVendorInput);

    // 3. Assert
    expect(res.id).toBe(1);
    expect(res.status).toBe('AKTIF');
    expect(prisma.vendor.create).toHaveBeenCalledWith({
      data: {
        nama: 'CV Berkah Unggas',
        telepon: '081234567890',
        email: 'berkah@unggas.com',
        alamat: null,
        catatan: null,
        status: 'AKTIF',
      }
    });
  });

  test('TC-VND-03 [Positive]: update memperbarui status dan catatan vendor dengan benar', async () => {
    // 1. Arrange
    prisma.vendor.findUnique.mockResolvedValue({ id: 1, nama: 'CV Berkah' });
    prisma.vendor.update.mockResolvedValue({ id: 1, nama: 'CV Berkah', status: 'NONAKTIF' });

    // 2. Act
    const res = await vendorService.update(1, { status: 'NONAKTIF' });

    // 3. Assert
    expect(res.status).toBe('NONAKTIF');
    expect(prisma.vendor.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'NONAKTIF' }
    });
  });

  test('TC-VND-04 [Positive]: remove berhasil menghapus vendor yang terdaftar', async () => {
    // 1. Arrange
    prisma.vendor.findUnique.mockResolvedValue({ id: 1, nama: 'CV Berkah' });
    prisma.vendor.delete.mockResolvedValue({ id: 1 });

    // 2. Act
    const res = await vendorService.remove(1);

    // 3. Assert
    expect(res).toBe(true);
    expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
