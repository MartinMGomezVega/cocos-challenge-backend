import type { Config } from 'jest';

const config: Config = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.int-spec.ts',
    '<rootDir>/test/functional/*.spec.ts',
  ],
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/support/global-setup-db.ts',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};

export default config;
