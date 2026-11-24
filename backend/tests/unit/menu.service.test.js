// ============================================================================
// UNIT TESTING: Menu Service (Feature 6: Menu) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Test Double Types:
//   1. Stub Object: Meniru data menu di findUnique & itemTransaksi
//   2. Mock Object: Memverifikasi bahwa delete TIDAK dipanggil saat menu masih terkait transaksi
// ============================================================================

const menuService = require('../../src/modules/menu/menu.service');
const prisma = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({
  menu: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  itemTransaksi: {
    findFirst: jest.fn(),
  },
}));

describe('White-Box Unit Testing: Feature 6 - Menu (menu.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-MNU-01 [Negative]: getById melempar error 404 MENU_NOT_FOUND jika menu tidak ada', async () => {
    // 1. Arrange (Stub: null)
    prisma.menu.findUnique.mockResolvedValue(null);

    // 2. Act & 3. Assert
    await expect(menuService.getById(999)).rejects.toEqual({
      status: 404,
      message: 'Menu tidak ditemukan',
      code: 'MENU_NOT_FOUND',
    });
  });

  test('TC-MNU-02 [Negative]: remove melempar error 400 MENU_IN_USE jika menu sudah dipakai transaksi', async () => {
    // 1. Arrange (Stub: menu ada, dan digunakan di transaksi)
    prisma.menu.findUnique.mockResolvedValue({ id: 1, nama: 'Ayam Bakar' });
    prisma.itemTransaksi.findFirst.mockResolvedValue({ id: 10, menuId: 1, transaksiId: 1 });

    // 2. Act & 3. Assert
    await expect(menuService.remove(1)).rejects.toEqual({
      status: 400,
      message: 'Menu tidak bisa dihapus karena masih terkait dengan transaksi',
      code: 'MENU_IN_USE',
    });

    // Mock verification: pastikan fungsi delete TIDAK pernah dipanggil
    expect(prisma.menu.delete).not.toHaveBeenCalled();
  });

  test('TC-MNU-03 [Positive]: remove berhasil menghapus menu jika tidak dipakai dalam transaksi', async () => {
    // 1. Arrange
    prisma.menu.findUnique.mockResolvedValue({ id: 8, nama: 'Menu Baru' });
    prisma.itemTransaksi.findFirst.mockResolvedValue(null);
    prisma.menu.delete.mockResolvedValue({ id: 8 });

    // 2. Act
    const res = await menuService.remove(8);

    // 3. Assert
    expect(res).toBe(true);
    expect(prisma.menu.delete).toHaveBeenCalledWith({ where: { id: 8 } });
  });

  test('TC-MNU-04 [Positive]: create berhasil membuat menu baru', async () => {
    // 1. Arrange
    const newMenuData = { nama: 'Es Teh Lemon', kategori: 'MINUMAN', harga: 5000 };
    prisma.menu.create.mockResolvedValue({ id: 15, ...newMenuData, isAvailable: true });

    // 2. Act
    const res = await menuService.create(newMenuData);

    // 3. Assert
    expect(res.id).toBe(15);
    expect(res.nama).toBe('Es Teh Lemon');
    expect(prisma.menu.create).toHaveBeenCalledWith({ data: newMenuData });
  });
});
