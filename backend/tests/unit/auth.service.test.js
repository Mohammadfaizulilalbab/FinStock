// ============================================================================
// UNIT TESTING: Feature 2 - Login (auth.service.login) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Target: 100% Statement Coverage
// Test Doubles:
//   1. Stub Object: prisma.pengguna.findUnique & bcrypt.compare
//   2. Mock Object: prisma.logAktivitas.create & jwt.signToken
//   3. Spy Object: console.warn (fallback sync handler)
// ============================================================================

const authService = require('../../src/modules/auth/auth.service');
const prisma = require('../../src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('../../src/utils/jwt');

jest.mock('../../src/config/db', () => ({
  pengguna: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  logAktivitas: {
    create: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('../../src/utils/jwt', () => ({
  signToken: jest.fn(),
}));

describe('White-Box Unit Testing: Feature 2 - Login (auth.service.login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-LOG-01 -> S1, S2, S3
  test('TC-LOG-01 [Negative]: Lempar error 401 INVALID_CREDENTIALS jika username tidak ditemukan', async () => {
    // Test Double 1 (Stub): findUnique mengembalikan null
    prisma.pengguna.findUnique.mockResolvedValue(null);

    await expect(authService.login('user_tidak_ada', 'pass123')).rejects.toEqual({
      status: 401,
      message: 'Username atau password salah',
      code: 'INVALID_CREDENTIALS',
    });

    // Test Double 2 (Mock): Memverifikasi method DB dipanggil dengan username yang tepat
    expect(prisma.pengguna.findUnique).toHaveBeenCalledWith({ where: { username: 'user_tidak_ada' } });
  });

  // TC-LOG-02 -> S1, S2, S4, S5
  test('TC-LOG-02 [Negative]: Lempar error 403 ACCOUNT_DISABLED jika status pengguna NONAKTIF', async () => {
    // Test Double 1 (Stub): User nonaktif
    prisma.pengguna.findUnique.mockResolvedValue({
      id: 6,
      username: 'karyawan_nonaktif',
      password: '$2a$10$hash',
      status: 'NONAKTIF',
    });

    await expect(authService.login('karyawan_nonaktif', 'pass123')).rejects.toEqual({
      status: 403,
      message: 'Akun Anda telah dinonaktifkan. Hubungi admin.',
      code: 'ACCOUNT_DISABLED',
    });
  });

  // TC-LOG-03 -> S1, S2, S4, S6, S7
  test('TC-LOG-03 [Negative]: Lempar error 401 INVALID_CREDENTIALS jika password salah', async () => {
    // Test Double 1 (Stub): User aktif, tapi bcrypt.compare false
    prisma.pengguna.findUnique.mockResolvedValue({
      id: 1,
      username: 'owner',
      password: '$2a$10$correctHash',
      status: 'AKTIF',
      role: 'OWNER',
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login('owner', 'salah123')).rejects.toEqual({
      status: 401,
      message: 'Username atau password salah',
      code: 'INVALID_CREDENTIALS',
    });
  });

  // TC-LOG-04 -> S1, S2, S4, S6, S8, S9, S12, S13, S14, S15
  test('TC-LOG-04 [Positive]: Berhasil login untuk OWNER dengan permissions lengkap', async () => {
    const ownerPerms = ['/', '/transaksi', '/kasir', '/menu'];
    prisma.pengguna.findUnique.mockResolvedValue({
      id: 1,
      nama: 'Admin Owner',
      username: 'owner',
      password: '$2a$10$correctHash',
      status: 'AKTIF',
      role: 'OWNER',
      permissions: ownerPerms,
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.signToken.mockReturnValue('jwt-token-owner');
    prisma.logAktivitas.create.mockResolvedValue({ id: 101 });

    const result = await authService.login('owner', 'owner123');

    expect(result.token).toBe('jwt-token-owner');
    expect(result.user.username).toBe('owner');
    expect(result.user.password).toBeUndefined();

    // Test Double 2 (Mock): Memverifikasi log aktivitas login dicatat
    expect(prisma.logAktivitas.create).toHaveBeenCalledWith({
      data: {
        penggunaId: 1,
        aksi: 'Login ke sistem',
      },
    });
  });

  // TC-LOG-05 -> S1..S10, S12..S15
  test('TC-LOG-05 [Positive]: Berhasil login KARYAWAN dan meng-auto-sync permissions default', async () => {
    prisma.pengguna.findUnique.mockResolvedValue({
      id: 2,
      nama: 'Kasir 1',
      username: 'kasir1',
      password: '$2a$10$hash',
      status: 'AKTIF',
      role: 'KARYAWAN',
      permissions: null,
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.signToken.mockReturnValue('jwt-token-kasir');
    prisma.pengguna.update.mockResolvedValue({});
    prisma.logAktivitas.create.mockResolvedValue({ id: 102 });

    const result = await authService.login('kasir1', 'pass123');

    expect(result.user.permissions).toEqual(['/', '/kasir', '/transaksi', '/menu', '/pengaturan']);
    expect(prisma.pengguna.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { permissions: ['/', '/kasir', '/transaksi', '/menu', '/pengaturan'] },
    });
  });

  // TC-LOG-06 -> S11 (Fallback error handler)
  test('TC-LOG-06 [Resilience]: Menangani kegagalan sinkronisasi permissions tanpa menggagalkan login', async () => {
    prisma.pengguna.findUnique.mockResolvedValue({
      id: 3,
      nama: 'Kasir 2',
      username: 'kasir2',
      password: '$2a$10$hash',
      status: 'AKTIF',
      role: 'KARYAWAN',
      permissions: [],
    });
    bcrypt.compare.mockResolvedValue(true);
    prisma.pengguna.update.mockRejectedValue(new Error('DB Timeout'));
    prisma.logAktivitas.create.mockResolvedValue({ id: 103 });

    // Test Double 3 (Spy): Memantau console.warn
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await authService.login('kasir2', 'pass123');
    expect(result.user.username).toBe('kasir2');
    expect(spyWarn).toHaveBeenCalledWith('Gagal sinkronisasi permissions ke database:', 'DB Timeout');

    spyWarn.mockRestore();
  });
});
