import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns an ok health response', () => {
    expect(new HealthController().health()).toEqual({ status: 'ok' });
  });
});
