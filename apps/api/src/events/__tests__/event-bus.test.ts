import { InMemoryEventBus, getEventBus, resetEventBus } from '../event-bus';

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  describe('subscribe and emit', () => {
    it('should call handler when event is emitted', async () => {
      const handler = jest.fn();
      bus.subscribe('TEST_EVENT', handler);
      await bus.emit('TEST_EVENT', { data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should call multiple handlers for same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bus.subscribe('TEST_EVENT', handler1);
      bus.subscribe('TEST_EVENT', handler2);
      await bus.emit('TEST_EVENT', { data: 'test' });
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should not call handler for different event', async () => {
      const handler = jest.fn();
      bus.subscribe('EVENT_A', handler);
      await bus.emit('EVENT_B', { data: 'test' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const handler = jest.fn();
      const unsubscribe = bus.subscribe('TEST_EVENT', handler);
      unsubscribe();
      await bus.emit('TEST_EVENT', { data: 'test' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all handlers for an event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bus.subscribe('TEST_EVENT', handler1);
      bus.subscribe('TEST_EVENT', handler2);
      bus.clear('TEST_EVENT');
      await bus.emit('TEST_EVENT', {});
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should not affect other events', async () => {
      const handlerA = jest.fn();
      const handlerB = jest.fn();
      bus.subscribe('EVENT_A', handlerA);
      bus.subscribe('EVENT_B', handlerB);
      bus.clear('EVENT_A');
      await bus.emit('EVENT_A', {});
      await bus.emit('EVENT_B', {});
      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should remove all handlers for all events', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      bus.subscribe('EVENT_A', handler1);
      bus.subscribe('EVENT_B', handler2);
      bus.clearAll();
      await bus.emit('EVENT_A', {});
      await bus.emit('EVENT_B', {});
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue calling handlers even if one throws', async () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();
      bus.subscribe('TEST_EVENT', errorHandler);
      bus.subscribe('TEST_EVENT', successHandler);
      await bus.emit('TEST_EVENT', {});
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });
});

describe('getEventBus singleton', () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  it('should return same instance', () => {
    const bus1 = getEventBus();
    const bus2 = getEventBus();
    expect(bus1).toBe(bus2);
  });
});
