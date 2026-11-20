import React from 'react';
import {
  ControlCentreProvider,
  useControlCentre,
} from './context/ControlCentreContext.tsx';
import { CinematicIntro } from './components/CinematicIntro.tsx';
import { TopNav } from './components/TopNav.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { TrainMonitorView } from './components/TrainMonitorView.tsx';
import { ConflictCentreView } from './components/ConflictCentreView.tsx';
import { AIDispatchView } from './components/AIDispatchView.tsx';
import { DigitalTwinView } from './components/DigitalTwinView.tsx';
import { SecondaryToolsDrawer } from './components/SecondaryToolsDrawer.tsx';
import { AssistantDrawer } from './components/AssistantDrawer.tsx';
import { DemoModeBar } from './components/DemoModeBar.tsx';

const RailRakshaShell: React.FC = () => {
  const { showIntro, activeView, demoStep } = useControlCentre();

  if (showIntro) {
    return <CinematicIntro />;
  }

  return (
    <div className="min-h-screen bg-[#060B14] text-slate-100">
      <TopNav />
      <main
        className={`mx-auto max-w-[1440px] px-4 py-6 md:px-6 ${
          demoStep !== null ? 'pb-36' : 'pb-12'
        }`}
      >
        {activeView === 'overview' && <OverviewView />}
        {activeView === 'monitor' && <TrainMonitorView />}
        {activeView === 'conflicts' && <ConflictCentreView />}
        {activeView === 'dispatch' && <AIDispatchView />}
        {activeView === 'twin' && <DigitalTwinView />}
      </main>
      <SecondaryToolsDrawer />
      <AssistantDrawer />
      <DemoModeBar />
    </div>
  );
};

export function App() {
  return (
    <ControlCentreProvider>
      <RailRakshaShell />
    </ControlCentreProvider>
  );
}

export default App;
