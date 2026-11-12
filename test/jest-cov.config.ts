import type { Config } from 'jest';

const config: Config = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/*.int-spec.ts',
    '<rootDir>/test/support/**/*.spec.ts',
    '<rootDir>/test/functional/*.spec.ts',
  ],
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/support/global-setup-db.ts',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.int-spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.dto.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/domain/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

export default config;
