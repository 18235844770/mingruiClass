import { NotFoundException } from '@nestjs/common';
import { LogsService } from './logs.service';

describe('LogsService remove soft delete', () => {
  const prisma = {
    operationLog: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new LogsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when log does not exist', async () => {
    prisma.operationLog.findUnique.mockResolvedValueOnce(null);
    await expect(service.remove('log-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.operationLog.update).not.toHaveBeenCalled();
  });

  it('throws when log already deleted', async () => {
    prisma.operationLog.findUnique.mockResolvedValueOnce({
      id: 'log-2',
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await expect(service.remove('log-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.operationLog.update).not.toHaveBeenCalled();
  });

  it('marks deleted_at when removing existing log', async () => {
    prisma.operationLog.findUnique.mockResolvedValueOnce({
      id: 'log-3',
      deletedAt: null,
    });
    prisma.operationLog.update.mockResolvedValueOnce({});

    const result = await service.remove('log-3');
    expect(result).toEqual({ success: true });
    expect(prisma.operationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-3' },
      }),
    );
  });
});
