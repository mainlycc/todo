import type { DailyTimeline } from '../types';
import { DailyNotePanel } from './DailyNotePanel';
import { DailyTimeline as DailyTimelineComponent } from './DailyTimeline';

export interface DaySidePanelProps {
  selectedDateStr: string;
  dailyNoteContent: string;
  onSaveDailyNote: (date: string, content: string) => void;
  dailyTimeline: DailyTimeline;
  onSaveDailyTimeline: (timeline: DailyTimeline) => void;
  workBlockDoneTasksForDay: { id: string; title: string }[];
}

export function DaySidePanel({
  selectedDateStr,
  dailyNoteContent,
  onSaveDailyNote,
  dailyTimeline,
  onSaveDailyTimeline,
  workBlockDoneTasksForDay,
}: DaySidePanelProps) {
  return (
    <div className="w-[440px] xl:w-[500px] flex-shrink-0">
      <DailyNotePanel
        date={selectedDateStr}
        content={dailyNoteContent}
        onChange={onSaveDailyNote}
      />
      <DailyTimelineComponent
        timeline={dailyTimeline}
        onUpdate={onSaveDailyTimeline}
        workBlockDoneTasks={workBlockDoneTasksForDay}
      />
    </div>
  );
}
