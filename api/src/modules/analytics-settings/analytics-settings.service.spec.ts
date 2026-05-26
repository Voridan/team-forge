import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnalyticsSettingsService } from './analytics-settings.service';
import { DEFAULT_ANALYTICS_THRESHOLDS } from './analytics-thresholds.constants';

type MockPrisma = {
  teamAnalyticsSettings: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

function makeMockPrisma(): MockPrisma {
  return {
    teamAnalyticsSettings: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';

const baseSettings = {
  teamId: TEAM_ID,
  ...DEFAULT_ANALYTICS_THRESHOLDS,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AnalyticsSettingsService', () => {
  let prisma: MockPrisma;
  let service: AnalyticsSettingsService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new AnalyticsSettingsService(prisma as never);
  });

  describe('get', () => {
    it('returns the settings row when present', async () => {
      prisma.teamAnalyticsSettings.findUnique.mockResolvedValue(baseSettings);

      const result = await service.get(TEAM_ID);

      expect(result).toEqual(baseSettings);
      expect(prisma.teamAnalyticsSettings.findUnique).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID },
      });
    });

    it('throws NotFoundException when the row is missing', async () => {
      prisma.teamAnalyticsSettings.findUnique.mockResolvedValue(null);

      await expect(service.get(TEAM_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('persists the patch when crit > warn for every pair', async () => {
      prisma.teamAnalyticsSettings.findUnique.mockResolvedValue(baseSettings);
      prisma.teamAnalyticsSettings.update.mockResolvedValue({
        ...baseSettings,
        workloadMaxMedianWarn: 1.5,
        workloadMaxMedianCrit: 2.5,
      });

      const result = await service.update(TEAM_ID, {
        workloadMaxMedianWarn: 1.5,
        workloadMaxMedianCrit: 2.5,
      });

      expect(prisma.teamAnalyticsSettings.update).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID },
        data: { workloadMaxMedianWarn: 1.5, workloadMaxMedianCrit: 2.5 },
      });
      expect(result.workloadMaxMedianWarn).toBe(1.5);
      expect(result.workloadMaxMedianCrit).toBe(2.5);
    });

    it('rejects when patched crit is not greater than warn', async () => {
      prisma.teamAnalyticsSettings.findUnique.mockResolvedValue(baseSettings);

      // crit == warn fails the strict-greater-than check
      await expect(
        service.update(TEAM_ID, {
          workloadMaxMedianWarn: 3.0,
          workloadMaxMedianCrit: 3.0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.teamAnalyticsSettings.update).not.toHaveBeenCalled();
    });

    it('rejects when patched warn would exceed the unchanged crit', async () => {
      prisma.teamAnalyticsSettings.findUnique.mockResolvedValue(baseSettings);

      // Only warn supplied; would now equal the existing crit value (3.0)
      await expect(
        service.update(TEAM_ID, { workloadMaxMedianWarn: 3.0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reports every offending pair in a single error', async () => {
      prisma.teamAnalyticsSettings.findUnique.mockResolvedValue(baseSettings);

      await expect(
        service.update(TEAM_ID, {
          workloadMaxMedianWarn: 5.0, // > existing crit (3.0)
          reviewP75DaysWarn: 10.0, // > existing crit (4.0)
        }),
      ).rejects.toThrow(/workloadMaxMedian.*reviewP75Days|reviewP75Days.*workloadMaxMedian/);
    });
  });

  describe('defaults', () => {
    it('exposes the named-constant defaults via the static helper', () => {
      expect(AnalyticsSettingsService.defaults()).toBe(DEFAULT_ANALYTICS_THRESHOLDS);
    });
  });
});
