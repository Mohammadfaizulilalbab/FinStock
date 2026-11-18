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

describe('White-Box Unit Testing: auth.service.register() [FinStock]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-REG-01 [Negative]: Harap melempar error MISSING_FIELDS jika input wajib kosong', async () => {
    await expect(authService.register({ nama: '', username: '', password: '' })).rejects.toEqual({
      status: 400,
      message: 'Nama, username, dan password wajib diisi',
      code: 'MISSING_FIELDS',
    });
  });

  test('TC-REG-02 [Negative]: Harap melempar error INVALID_ROLE jika role tidak valid', async () => {
    await expect(authService.register({ nama: 'Fulan', username: 'fulan', password: 'password123', role: 'SUPERUSER' })).rejects.toEqual({
      status: 400,
      message: 'Role tidak valid',
      code: 'INVALID_ROLE',
    });
  });

  test('TC-REG-03 [Negative]: Harap melempar error USERNAME_EXISTS jika username sudah dipakai', async () => {
    prisma.pengguna.findUnique.mockResolvedValue({ id: 1, username: 'owner' });

    await expect(authService.register({ nama: 'Owner 2', username: 'owner', password: 'password123' })).rejects.toEqual({
      status: 400,
      message: 'Username sudah digunakan',
      code: 'USERNAME_EXISTS',
    });
    expect(prisma.pengguna.findUnique).toHaveBeenCalledWith({ where: { username: 'owner' } });
  });

  test('TC-REG-04 [Positive]: Harap berhasil registrasi akun KARYAWAN baru', async () => {
    prisma.pengguna.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('$2a$10$hashedPassNew');
    const createdUser = {
      id: 20,
      nama: 'Karyawan Baru',
      username: 'karyawan_baru',
      password: '$2a$10$hashedPassNew',
      role: 'KARYAWAN',
      permissions: ['/', '/kasir', '/transaksi', '/menu', '/pengaturan'],
      status: 'AKTIF',
    };
    prisma.pengguna.create.mockResolvedValue(createdUser);

    const result = await authService.register({
      nama: 'Karyawan Baru',
      username: 'karyawan_baru',
      password: 'password123',
    });

    expect(result).toBeDefined();
    expect(result.username).toBe('karyawan_baru');
    expect(result.password).toBeUndefined();
    expect(result.permissions).toHaveLength(5);
  });
});
