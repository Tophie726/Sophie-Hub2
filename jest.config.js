/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Include colocated tests under src/**/__tests__ as well as top-level __tests__.
  roots: ['<rootDir>/__tests__', '<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^server-only$': '<rootDir>/__tests__/__mocks__/server-only.js',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.d.ts',
    '!src/lib/**/index.ts',
  ],
}

module.exports = config
