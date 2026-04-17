import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return ok payload', () => {
      expect(appController.health()).toEqual(
        expect.objectContaining({ ok: true, service: 'mingrui-backend' }),
      );
    });
  });
});
