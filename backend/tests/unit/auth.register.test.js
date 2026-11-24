// ============================================================================
// UNIT TESTING: Feature 1 - Register (auth.service.register) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Target: 100% Statement Coverage
// Test Doubles:
//   1. Stub Object: Prisma findUnique (user exists / null) & bcrypt.hash
//   2. Mock Object: Prisma create verification & check password hashing call
// ============================================================================

const authService = require('../../src/modules/auth/auth.service');
const prisma = require('../../src/config/db');
const bcrypt = require('bcryptjs');

jest.mock('../../src/config/db', () => ({
  pengguna: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('White-Box Unit Testing: Feature 1 - Register (auth.service.register)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-REG-01 -> S1, S2, S3
  test('TC-REG-01 [Negative]: Lempar error MISSING_FIELDS jika nama, username, atau password kosong', async () => {
    await expect(authService.register({ nama: '', username: 'budi', password: 'password123' })).rejects.toEqual({
      status: 400,
      message: 'Nama, username, dan password wajib diisi',
      code: 'MISSING_FIELDS',
    });
  });

  // TC-REG-02 -> S1, S2, S4, S5
  test('TC-REG-02 [Negative]: Lempar error INVALID_ROLE jika role selain OWNER/KARYAWAN', async () => {
    await expect(authService.register({ nama: 'Budi', username: 'budi01', password: 'password123', role: 'ADMIN' })).rejects.toEqual({
      status: 400,
      message: 'Role tidak valid',
      code: 'INVALID_ROLE',
    });
  });

  // TC-REG-03 -> S1, S2, S4, S6, S7
  test('TC-REG-03 [Negative]: Lempar error USERNAME_EXISTS jika username sudah terdaftar', async () => {
    // Test Double 1 (Stub): Meniru findUnique mengembalikan record pengguna lama
    prisma.pengguna.findUnique.mockResolvedValue({ id: 1, username: 'budi01' });

    await expect(authService.register({ nama: 'Budi Baru', username: 'budi01', password: 'password123' })).rejects.toEqual({
      status: 400,
      message: 'Username sudah digunakan',
      code: 'USERNAME_EXISTS',
    });

    // Test Double 2 (Mock): Memverifikasi Prisma findUnique dipanggil dengan query yang benar
    expect(prisma.pengguna.findUnique).toHaveBeenCalledWith({ where: { username: 'budi01' } });
  });

  // TC-REG-04 -> S1, S2, S4, S6, S8, S9, S10, S11, S12, S13
  test('TC-REG-04 [Positive]: Berhasil mendaftarkan pengguna KARYAWAN baru dan men-sanitize password', async () => {
    // Test Double 1 (Stub): findUnique null & bcrypt hash mengembalikan string hash
    prisma.pengguna.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('$2a$10$hashedPassNew');

    const createdUser = {
      id: 20,
      nama: 'Budi Karyawan',
      username: 'budi_new',
      password: '$2a$10$hashedPassNew',
      role: 'KARYAWAN',
      permissions: ['/', '/kasir', '/transaksi', '/menu', '/pengaturan'],
      status: 'AKTIF',
    };
    prisma.pengguna.create.mockResolvedValue(createdUser);

    const result = await authService.register({
      nama: 'Budi Karyawan',
      username: 'budi_new',
      password: 'password123',
      role: 'KARYAWAN',
    });

    // Verifikasi output
    expect(result).toBeDefined();
    expect(result.username).toBe('budi_new');
    expect(result.password).toBeUndefined(); // password disanitasi
    expect(result.permissions).toHaveLength(5);

    // Test Double 2 (Mock): Memverifikasi data create dipanggil dengan status AKTIF
    expect(prisma.pengguna.create).toHaveBeenCalledWith({
      data: {
        nama: 'Budi Karyawan',
        username: 'budi_new',
        password: '$2a$10$hashedPassNew',
        role: 'KARYAWAN',
        permissions: ['/', '/kasir', '/transaksi', '/menu', '/pengaturan'],
        status: 'AKTIF',
      },
    });
  });

  // TC-REG-05 -> S1, S2, S4, S6, S8, S9, S10, S11, S12, S13 (Owner path)
  test('TC-REG-05 [Positive]: Berhasil mendaftarkan pengguna OWNER baru dengan permissions lengkap', async () => {
    prisma.pengguna.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('$2a$10$hashedPassOwner');

    const createdOwner = {
      id: 21,
      nama: 'Owner Baru',
      username: 'owner_new',
      password: '$2a$10$hashedPassOwner',
      role: 'OWNER',
      permissions: ['/', '/transaksi', '/kasir', '/pengeluaran', '/menu', '/persediaan', '/laporan', '/vendor', '/pengguna', '/pengaturan'],
      status: 'AKTIF',
    };
    prisma.pengguna.create.mockResolvedValue(createdOwner);

    const result = await authService.register({
      nama: 'Owner Baru',
      username: 'owner_new',
      password: 'ownerPass123',
      role: 'OWNER',
    });

    expect(result.role).toBe('OWNER');
    expect(result.permissions).toHaveLength(10);
  });
});
