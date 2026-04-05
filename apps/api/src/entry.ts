// Entry point: configure Node.js settings before loading the app
// This runs BEFORE any other imports, ensuring listeners are not counted
process.setMaxListeners(0);

// Load the actual application
await import('./index.ts');

export {};
