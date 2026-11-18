// ============================================================================
// UNIT TESTING: Auth Service (Login Feature) — FinStock
// Standar: White-Box Testing (Basis Path, Statement & Branch Coverage 100%)
// Pattern: Arrange - Act - Assert (AAA)
// Test Double Types:
//   1. Mock Object (jest.fn() & jest.spyOn()) -> Memverifikasi interaksi method
//   2. Stub Object (Predefined resolved/rejected responses) -> Meniru respons database/bcrypt
//   3. Dummy Object ({}) -> Parameter tambahan yang tidak mempengaruhi logika inti
// ============================================================================

const authService = require('../../src/modules/auth/auth.service');
const prisma = require('../../src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('../../src/utils/jwt');

// Mock external modules untuk mengisolasi auth.service secara murni
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

describe('White-Box Unit Testing: auth.service.login() [FinStock]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // PATH 1 (S1 -> S2 -> S3)
  // TC-01: User tidak ditemukan dalam database -> throw INVALID_CREDENTIALS
  // Covered Statements: S1, S2, S3
  // Covered Branches: B1 (True)
  // --------------------------------------------------------------------------
  test('TC-01 [Negative]: Harap melempar error 401 INVALID_CREDENTIALS jika username tidak ditemukan', async () => {
    // 1. Arrange
    // Test Double: STUB - prisma.pengguna.findUnique mengembalikan predefined null
    prisma.pengguna.findUnique.mockResolvedValue(null);

    const inputUsername = 'non_existent_user';
    const inputPassword = 'password123';

    // 2. Act & 3. Assert
    await expect(authService.login(inputUsername, inputPassword)).rejects.toEqual({
      status: 401,
      message: 'Username atau password salah',
      code: 'INVALID_CREDENTIALS',
    });

    // Test Double: MOCK - verifikasi interaksi database dipanggil dengan parameter yang benar
    expect(prisma.pengguna.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.pengguna.findUnique).toHaveBeenCalledWith({
      where: { username: inputUsername },
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(jwt.signToken).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // PATH 2 (S1 -> S2 -> S4 -> S5)
  // TC-02: Akun ditemukan tetapi berstatus NONAKTIF -> throw ACCOUNT_DISABLED
  // Covered Statements: S1, S2, S4, S5
  // Covered Branches: B1 (False), B2 (True)
  // --------------------------------------------------------------------------
  test('TC-02 [Negative]: Harap melempar error 403 ACCOUNT_DISABLED jika status pengguna NONAKTIF', async () => {
    // 1. Arrange
    // Test Double: STUB - mengembalikan user dengan status NONAKTIF
    const stubInactiveUser = {
      id: 5,
      username: 'karyawan_nonaktif',
      password: '$2a$10$hashedPassword123',
      status: 'NONAKTIF',
      role: 'KARYAWAN',
      permissions: ['/kasir'],
    };
    prisma.pengguna.findUnique.mockResolvedValue(stubInactiveUser);

    const inputUsername = 'karyawan_nonaktif';
    const inputPassword = 'password123';

    // 2. Act & 3. Assert
    await expect(authService.login(inputUsername, inputPassword)).rejects.toEqual({
      status: 403,
      message: 'Akun Anda telah dinonaktifkan. Hubungi admin.',
      code: 'ACCOUNT_DISABLED',
    });

    expect(prisma.pengguna.findUnique).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // PATH 3 (S1 -> S2 -> S4 -> S6 -> S7)
  // TC-03: Akun ditemukan dan aktif, tetapi password salah -> throw INVALID_CREDENTIALS
  // Covered Statements: S1, S2, S4, S6, S7
  // Covered Branches: B1 (False), B2 (False), B3 (True)
  // --------------------------------------------------------------------------
  test('TC-03 [Negative]: Harap melempar error 401 INVALID_CREDENTIALS jika password salah (hash tidak cocok)', async () => {
    // 1. Arrange
    const stubActiveUser = {
      id: 1,
      username: 'owner',
      password: '$2a$10$correctHashedPassword',
      status: 'AKTIF',
      role: 'OWNER',
      permissions: ['/dashboard', '/transaksi'],
    };
    prisma.pengguna.findUnique.mockResolvedValue(stubActiveUser);

    // Test Double: STUB - bcrypt.compare mengembalikan false
    bcrypt.compare.mockResolvedValue(false);

    const inputUsername = 'owner';
    const inputWrongPassword = 'wrong_password';

    // 2. Act & 3. Assert
    await expect(authService.login(inputUsername, inputWrongPassword)).rejects.toEqual({
      status: 401,
      message: 'Username atau password salah',
      code: 'INVALID_CREDENTIALS',
    });

    // Test Double: MOCK - verifikasi bcrypt.compare menerima input password & hash yang tepat
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).toHaveBeenCalledWith(inputWrongPassword, stubActiveUser.password);
    expect(jwt.signToken).not.toHaveBeenCalled();
    expect(prisma.logAktivitas.create).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // PATH 4 (S1 -> S2 -> S4 -> S6 -> S8 -> S12 -> S13 -> S14 -> S15)
  // TC-04: Login Owner sukses dengan permissions yang sudah lengkap
  // Covered Statements: S1, S2, S4, S6, S8, S12, S13, S14, S15
  // Covered Branches: B1 (False), B2 (False), B3 (False), B4 (False)
  // --------------------------------------------------------------------------
  test('TC-04 [Positive]: Harap berhasil login untuk akun OWNER dengan permissions yang telah terdefinisi', async () => {
    // 1. Arrange
    const existingOwnerPermissions = [
      '/', '/transaksi', '/kasir', '/pengeluaran', '/menu', '/persediaan', '/laporan', '/vendor', '/pengguna', '/pengaturan'
    ];
    const stubOwner = {
      id: 1,
      nama: 'Admin Owner',
      username: 'owner',
      password: '$2a$10$correctHashedPassword',
      status: 'AKTIF',
      role: 'OWNER',
      permissions: existingOwnerPermissions,
    };
    const stubToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyTokenOwner';

    prisma.pengguna.findUnique.mockResolvedValue(stubOwner);
    bcrypt.compare.mockResolvedValue(true);
    jwt.signToken.mockReturnValue(stubToken);
    prisma.logAktivitas.create.mockResolvedValue({ id: 101 });

    const inputUsername = 'owner';
    const inputPassword = 'ownerPassword123';

    // 2. Act
    const result = await authService.login(inputUsername, inputPassword);

    // 3. Assert
    expect(result).toBeDefined();
    expect(result.token).toBe(stubToken);
    expect(result.user.username).toBe('owner');
    expect(result.user.role).toBe('OWNER');
    expect(result.user.password).toBeUndefined(); // Verifikasi data sensitif tidak terekspos
    expect(result.user.permissions).toEqual(existingOwnerPermissions);

    // Test Double MOCK Verifications
    expect(prisma.pengguna.update).not.toHaveBeenCalled(); // Karena OWNER tidak perlu default permissions karyawan
    expect(jwt.signToken).toHaveBeenCalledWith({
      id: stubOwner.id,
      username: stubOwner.username,
      role: stubOwner.role,
      permissions: existingOwnerPermissions,
    });
    expect(prisma.logAktivitas.create).toHaveBeenCalledWith({
      data: {
        penggunaId: stubOwner.id,
        aksi: 'Login ke sistem',
      },
    });
  });

  // --------------------------------------------------------------------------
  // PATH 5 (S1 -> S2 -> S4 -> S6 -> S8 -> S9 -> S10 -> S12 -> S13 -> S14 -> S15)
  // TC-05: Login Karyawan sukses dengan permissions null/kosong (auto-sync default permissions)
  // Covered Statements: S1, S2, S4, S6, S8, S9, S10, S12, S13, S14, S15
  // Covered Branches: B1 (False), B2 (False), B3 (False), B4 (True)
  // --------------------------------------------------------------------------
  test('TC-05 [Positive & Edge]: Harap memberikan default permissions untuk akun KARYAWAN baru jika permissions masih null', async () => {
    // 1. Arrange
    const stubKaryawanNew = {
      id: 3,
      nama: 'Budi Santoso',
      username: 'budi_kasir',
      password: '$2a$10$karyawanHashedPassword',
      status: 'AKTIF',
      role: 'KARYAWAN',
      permissions: null, // belum di-set di DB
    };
    const defaultPermissionsExpected = ['/', '/kasir', '/transaksi', '/menu', '/pengaturan'];
    const stubToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyTokenKaryawan';

    prisma.pengguna.findUnique.mockResolvedValue(stubKaryawanNew);
    bcrypt.compare.mockResolvedValue(true);
    jwt.signToken.mockReturnValue(stubToken);
    prisma.pengguna.update.mockResolvedValue({ ...stubKaryawanNew, permissions: defaultPermissionsExpected });
    prisma.logAktivitas.create.mockResolvedValue({ id: 102 });

    // 2. Act
    const result = await authService.login('budi_kasir', 'pass123');

    // 3. Assert
    expect(result.token).toBe(stubToken);
    expect(result.user.permissions).toEqual(defaultPermissionsExpected);

    // Memverifikasi interaksi sinkronisasi database untuk karyawan
    expect(prisma.pengguna.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { permissions: defaultPermissionsExpected },
    });
    expect(jwt.signToken).toHaveBeenCalledWith({
      id: 3,
      username: 'budi_kasir',
      role: 'KARYAWAN',
      permissions: defaultPermissionsExpected,
    });
  });

  // --------------------------------------------------------------------------
  // PATH 6 (S1 -> S2 -> S4 -> S6 -> S8 -> S9 -> S11 -> S12 -> S13 -> S14 -> S15)
  // TC-06: Error handling saat sinkronisasi permissions gagal (catch block S11)
  // Covered Statements: S11 (console.warn error handler)
  // --------------------------------------------------------------------------
  test('TC-06 [Resilience]: Harap menangani kegagalan update permissions dengan aman (fallback catch block)', async () => {
    // 1. Arrange
    const stubKaryawanErr = {
      id: 4,
      nama: 'Sari',
      username: 'sari_kasir',
      password: '$2a$10$sariHashedPassword',
      status: 'AKTIF',
      role: 'KARYAWAN',
      permissions: [],
    };
    prisma.pengguna.findUnique.mockResolvedValue(stubKaryawanErr);
    bcrypt.compare.mockResolvedValue(true);
    prisma.pengguna.update.mockRejectedValue(new Error('Database lock error'));
    prisma.logAktivitas.create.mockResolvedValue({ id: 103 });

    // Test Double: SPY - memantau pemanggilan console.warn tanpa merusak output tes
    const spyConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // 2. Act
    const result = await authService.login('sari_kasir', 'sari123');

    // 3. Assert: Login tetap berhasil meskipun update async permissions gagal
    expect(result).toBeDefined();
    expect(result.user.username).toBe('sari_kasir');
    expect(spyConsoleWarn).toHaveBeenCalledTimes(1);
    expect(spyConsoleWarn).toHaveBeenCalledWith(
      'Gagal sinkronisasi permissions ke database:',
      'Database lock error'
    );

    spyConsoleWarn.mockRestore();
  });
});
