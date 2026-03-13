import type { Response } from 'express';

import { LeccionController } from '@/infrastructure/adapters/http/controllers/LeccionController';
import type { AuthRequest } from '@/infrastructure/adapters/http/middleware/auth';

describe('LeccionController', () => {
  let controller: LeccionController;
  let mockStart: jest.Mock;
  let mockInteract: jest.Mock;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const testUserId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    mockStart = jest.fn();
    mockInteract = jest.fn();
    const mockUseCase = { start: mockStart, interact: mockInteract };

    controller = new LeccionController(mockUseCase as any);

    mockRequest = {
      body: {},
      user: {
        id: testUserId,
        email: 'test@test.com',
        role: 'STUDENT',
      },
    };

    mockResponse = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    mockNext = jest.fn();
  });

  it('should start a lesson', async () => {
    mockRequest.body = {
      lessonId: '123e4567-e89b-12d3-a456-426614174000',
    };

    mockStart.mockResolvedValue({
      sessionId: 'session-1',
      voiceText: 'Lesson started',
      pedagogicalState: 'EXPLANATION',
    });

    await controller.start(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStart).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', testUserId);
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith({
      sessionId: 'session-1',
      voiceText: 'Lesson started',
      pedagogicalState: 'EXPLANATION',
    });
  });

  it('should interact with a lesson', async () => {
    mockRequest.body = {
      sessionId: '123e4567-e89b-12d3-a456-426614174002',
      studentInput: 'Test input',
    };

    mockInteract.mockResolvedValue({
      voiceText: 'Test response',
      pedagogicalState: 'QUESTION',
      sessionCompleted: false,
    });

    await controller.interact(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockInteract).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174002', 'Test input');
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      voiceText: 'Test response',
      pedagogicalState: 'QUESTION',
      sessionCompleted: false,
    });
  });

  it('should handle errors on start', async () => {
    mockRequest.body = {
      lessonId: '123e4567-e89b-12d3-a456-426614174000',
    };

    mockStart.mockRejectedValue(new Error('Test error'));

    await controller.start(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle errors on interact', async () => {
    mockRequest.body = {
      sessionId: '123e4567-e89b-12d3-a456-426614174002',
      studentInput: 'Test input',
    };

    mockInteract.mockRejectedValue(new Error('Test error'));

    await controller.interact(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should return 401 if user is not authenticated', async () => {
    mockRequest.user = undefined;
    mockRequest.body = {
      lessonId: '123e4567-e89b-12d3-a456-426614174000',
    };

    await controller.start(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 if lessonId missing', async () => {
    mockRequest.body = {};

    await controller.start(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        details: expect.any(Array),
      }),
    );
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 if sessionId or studentInput missing', async () => {
    mockRequest.body = {
      sessionId: '123e4567-e89b-12d3-a456-426614174002',
    };

    await controller.interact(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        details: expect.any(Array),
      }),
    );
    expect(mockInteract).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });
});
