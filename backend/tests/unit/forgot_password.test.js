// ============================================================================
// UNIT TESTING: Auth Service (Feature 3: Forgot Password) — FinStock
// Standard: White-Box Testing (AAA Pattern)
// Test Double Types:
//   1. Stub Object: Meniru kembalian database prisma dan bcrypt
//   2. Mock Object: Memverifikasi pemanggilan fungsi sendResetPasswordEmail & prisma.pengguna.findFirst
//   3. Spy Object: Memantau implementasi maskEmail
// ============================================================================

const authService = require('../../src/modules/auth/auth.service');
const prisma = require('../../src/config/db');
const mailer = require('../../src/utils/mailer');
const bcrypt = require('bcryptjs');

jest.mock('../../src/config/db', () => ({
  pengguna: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../src/utils/mailer', () => ({
  sendResetPasswordEmail: jest.fn(),
  maskEmail: jest.fn((email) => 'o***r@gmail.com'),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('White-Box Unit Testing: Feature 3 - Forgot Password (auth.service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC-FP-01 [Negative]: Lempar error 400 jika identifier kosong', async () => {
    // 1. Arrange & 2. Act & 3. Assert
    await expect(authService.requestPasswordReset('')).rejects.toEqual({
      status: 400,
      message: 'Username atau email wajib diisi',
      code: 'MISSING_IDENTIFIER',
    });
  });

  test('TC-FP-02 [Negative]: Lempar error 404 jika pengguna tidak terdaftar', async () => {
    // 1. Arrange (Stub: findFirst mengembalikan null)
    prisma.pengguna.findFirst.mockResolvedValue(null);

    // 2. Act & 3. Assert
    await expect(authService.requestPasswordReset('non_existent@gmail.com')).rejects.toEqual({
      status: 404,
      message: 'Pengguna dengan username atau email tersebut tidak ditemukan',
      code: 'USER_NOT_FOUND',
    });
  });

  test('TC-FP-03 [Negative]: Lempar error 403 jika akun berstatus NONAKTIF', async () => {
    // 1. Arrange (Stub: user nonaktif)
    prisma.pengguna.findFirst.mockResolvedValue({
      id: 6,
      username: 'karyawan_nonaktif',
      status: 'NONAKTIF',
      email: 'nonaktif@finstock.com',
    });

    // 2. Act & 3. Assert
    await expect(authService.requestPasswordReset('karyawan_nonaktif')).rejects.toEqual({
      status: 403,
      message: 'Akun Anda dinonaktifkan, silakan hubungi admin',
      code: 'ACCOUNT_DISABLED',
    });
  });

  test('TC-FP-04 [Positive]: Berhasil meminta reset password & mengirim email OTP', async () => {
    // 1. Arrange
    const stubUser = {
      id: 1,
      nama: 'Admin Owner',
      username: 'owner',
      email: 'owner@finstock.com',
      status: 'AKTIF',
    };
    prisma.pengguna.findFirst.mockResolvedValue(stubUser);
    mailer.sendResetPasswordEmail.mockResolvedValue(true);

    // 2. Act
    const result = await authService.requestPasswordReset('owner');

    // 3. Assert
    expect(result).toBeDefined();
    expect(result.username).toBe('owner');
    expect(result.email).toBe('owner@finstock.com');
    // Mock interaction check
    expect(mailer.sendResetPasswordEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendResetPasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@finstock.com',
        name: 'Admin Owner',
      })
    );
  });
});
