const { logInfo, logError, logDebug } = require('../src/utils/logger');
const { readJson, writeJson } = require('../src/utils/json');
const fs = require('fs');
const path = require('path');

describe('Logger Utils', () => {
  let consoleLogSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('logInfo devrait logger avec préfixe [info]', () => {
    logInfo('Test message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[info]', 'Test message');
  });

  test('logError devrait logger avec préfixe [error]', () => {
    logError('Error message');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[error]', 'Error message');
  });

  test('logDebug devrait logger uniquement si DEBUG=true', () => {
    const originalDebug = process.env.DEBUG;
    
    process.env.DEBUG = 'false';
    logDebug('Debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockClear();
    process.env.DEBUG = 'true';
    
    // Recharger le module pour prendre en compte le nouveau DEBUG_ENABLED
    jest.resetModules();
    const { logDebug: logDebugReloaded } = require('../src/utils/logger');
    const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    logDebugReloaded('Debug message');
    expect(consoleDebugSpy).toHaveBeenCalledWith('[debug]', 'Debug message');

    consoleDebugSpy.mockRestore();
    process.env.DEBUG = originalDebug;
  });
});

describe('JSON Utils', () => {
  const testDir = path.join(__dirname, 'test-data');
  const testFile = path.join(testDir, 'test.json');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('readJson devrait lire un fichier JSON valide', async () => {
    const data = { test: 'value', number: 42 };
    fs.writeFileSync(testFile, JSON.stringify(data, null, 2));

    const result = await readJson(testFile);
    expect(result).toEqual(data);
  });

  test('readJson devrait retourner defaultValue si fichier inexistant', async () => {
    const result = await readJson('/non/existent/file.json', { default: true });
    expect(result).toEqual({ default: true });
  });

  test('writeJson devrait écrire un fichier JSON valide', async () => {
    const data = { write: 'test', array: [1, 2, 3] };
    await writeJson(testFile, data);

    const content = fs.readFileSync(testFile, 'utf8');
    expect(JSON.parse(content)).toEqual(data);
  });

  test('writeJson devrait créer le dossier parent si inexistant', async () => {
    const nestedFile = path.join(testDir, 'nested', 'deep', 'test.json');
    const data = { nested: true };
    
    await writeJson(nestedFile, data);
    
    expect(fs.existsSync(nestedFile)).toBe(true);
    const result = await readJson(nestedFile);
    expect(result).toEqual(data);
  });
});
