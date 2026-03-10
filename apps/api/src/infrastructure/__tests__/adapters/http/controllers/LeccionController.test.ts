import type { Request, Response } from 'express';

import { LeccionController } from '@/infrastructure/adapters/http/controllers/LeccionController';

describe('LeccionController', () => {
  let controller: LeccionController;
  let mockStart: jest.Mock;
  let mockInteract: jest.Mock;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockStart = jest.fn();
    mockInteract = jest.fn();
    const mockUseCase = { start: mockStart, interact: mockInteract };

    controller = new LeccionController(mockUseCase as any);

    mockRequest = {
      body: {},
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
      studentId: '123e4567-e89b-12d3-a456-426614174001',
    };

    mockStart.mockResolvedValue({
      sessionId: 'session-1',
      voiceText: 'Lesson started',
      pedagogicalState: 'EXPLANATION',
    });

    await controller.start(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockStart).toHaveBeenCalledWith(
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
    );
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

    await controller.interact(mockRequest as Request, mockResponse as Response, mockNext);

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
      studentId: '123e4567-e89b-12d3-a456-426614174001',
    };

    mockStart.mockRejectedValue(new Error('Test error'));

    await controller.start(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle errors on interact', async () => {
    mockRequest.body = {
      sessionId: '123e4567-e89b-12d3-a456-426614174002',
      studentInput: 'Test input',
    };

    mockInteract.mockRejectedValue(new Error('Test error'));

    await controller.interact(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should return 400 if lessonId or studentId missing', async () => {
    mockRequest.body = {
      lessonId: '123e4567-e89b-12d3-a456-426614174000',
    };

    await controller.start(mockRequest as Request, mockResponse as Response, mockNext);

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

    await controller.interact(mockRequest as Request, mockResponse as Response, mockNext);

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
