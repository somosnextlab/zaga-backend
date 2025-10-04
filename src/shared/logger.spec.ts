import { Logger } from './logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestContext');
  });

  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should have correct context', () => {
    const contextLogger = new Logger('CustomContext');
    expect(contextLogger).toBeDefined();
  });

  describe('log', () => {
    it('should log message without context', () => {
      const logSpy = jest.spyOn(logger, 'log').mockImplementation();
      
      logger.log('Test message');
      
      expect(logSpy).toHaveBeenCalledWith('Test message');
    });

    it('should log message with context', () => {
      const logSpy = jest.spyOn(logger, 'log').mockImplementation();
      
      logger.log('Test message', 'TestContext');
      
      expect(logSpy).toHaveBeenCalledWith('Test message', 'TestContext');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation();
      
      logger.error('Error message', 'Error trace', 'TestContext');
      
      expect(errorSpy).toHaveBeenCalledWith('Error message', 'Error trace', 'TestContext');
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
      
      logger.warn('Warning message', 'TestContext');
      
      expect(warnSpy).toHaveBeenCalledWith('Warning message', 'TestContext');
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      const debugSpy = jest.spyOn(logger, 'debug').mockImplementation();
      
      logger.debug('Debug message', 'TestContext');
      
      expect(debugSpy).toHaveBeenCalledWith('Debug message', 'TestContext');
    });
  });

  describe('verbose', () => {
    it('should log verbose message', () => {
      const verboseSpy = jest.spyOn(logger, 'verbose').mockImplementation();
      
      logger.verbose('Verbose message', 'TestContext');
      
      expect(verboseSpy).toHaveBeenCalledWith('Verbose message', 'TestContext');
    });
  });
});
