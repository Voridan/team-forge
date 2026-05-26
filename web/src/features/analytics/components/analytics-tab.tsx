import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottlenecksView } from './bottlenecks-view';
import { OverviewView } from './overview-view';
import { ThroughputView } from './throughput-view';
import { WorkloadView } from './workload-view';

type SubTab = 'overview' | 'workload' | 'throughput' | 'bottlenecks';

const VALID_SUB_TABS: SubTab[] = ['overview', 'workload', 'throughput', 'bottlenecks'];

function parseSubTab(raw: string | null): SubTab {
  return raw && (VALID_SUB_TABS as string[]).includes(raw) ? (raw as SubTab) : 'overview';
}

interface AnalyticsTabProps {
  teamId: string;
}

export function AnalyticsTab({ teamId }: AnalyticsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTab = parseSubTab(searchParams.get('view'));

  const setSubTab = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'overview') {
        next.delete('view');
      } else {
        next.set('view', value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleJump = useCallback(
    (link: string) => {
      if ((VALID_SUB_TABS as string[]).includes(link)) {
        setSubTab(link);
      }
    },
    [setSubTab],
  );

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="workload">Workload</TabsTrigger>
        <TabsTrigger value="throughput">Throughput</TabsTrigger>
        <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <OverviewView teamId={teamId} onJump={handleJump} />
      </TabsContent>
      <TabsContent value="workload" className="mt-4">
        <WorkloadView teamId={teamId} />
      </TabsContent>
      <TabsContent value="throughput" className="mt-4">
        <ThroughputView teamId={teamId} />
      </TabsContent>
      <TabsContent value="bottlenecks" className="mt-4">
        <BottlenecksView teamId={teamId} />
      </TabsContent>
    </Tabs>
  );
}
