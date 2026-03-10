// Test for Request ID Middleware
import type { Request, Response } from 'express';

import { requestIdMiddleware } from '@/infrastructure/adapters/http/middleware/request-id';

describe('requestIdMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should add request ID to request', () => {
    requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect((mockRequest as any).requestId).toBeDefined();
    expect(typeof (mockRequest as any).requestId).toBe('string');
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      (mockRequest as any).requestId,
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use existing request ID if provided', () => {
    mockRequest.headers = {
      'x-request-id': 'existing-id',
    };

    requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect((mockRequest as any).requestId).toBe('existing-id');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-id');
  });
});
