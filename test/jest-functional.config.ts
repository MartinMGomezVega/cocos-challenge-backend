import type { Config } from 'jest';

const config: Config = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/functional/*.spec.ts'],
  maxWorkers: 1,
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};

export default config;
