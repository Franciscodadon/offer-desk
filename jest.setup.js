// Keep test output honest: a console.error from React is usually a real bug.
// Fail loudly rather than letting it scroll past.
const originalError = console.error;

beforeAll(() => {
  console.error = (...args) => {
    originalError(...args);
    throw new Error(`console.error during test: ${args[0]}`);
  };
});

afterAll(() => {
  console.error = originalError;
});
