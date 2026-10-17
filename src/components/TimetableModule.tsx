import React, { useState } from 'react';
import { Clock, Plus, Trash2, MapPin, AlertCircle } from 'lucide-react';
import { AppState, DayOfWeek, SlotType, TimetableSlot } from '../types';
import { DAYS_OF_WEEK, DAY_NAMES, timeToMinutes } from '../services/scheduler';

interface TimetableModuleProps {
  state: AppState;
  onSaveSlot: (slot: TimetableSlot) => void;
  onDeleteSlot: (slotId: string) => void;
}

export const TimetableModule: React.FC<TimetableModuleProps> = ({
  state,
  onSaveSlot,
  onDeleteSlot,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [isAddingSlot, setIsAddingSlot] = useState<boolean>(false);

  // Form State
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<SlotType>('lecture');
  const [isFixed, setIsFixed] = useState<boolean>(true);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newSlot: TimetableSlot = {
      id: `tt-${Date.now()}`,
      semesterId: state.activeSemesterId,
      subjectId: subjectId || undefined,
      title: title.trim(),
      dayOfWeek,
      startTime,
      endTime,
      location: location.trim() || undefined,
      type,
      isFixed,
    };

    onSaveSlot(newSlot);
    setTitle('');
    setLocation('');
    setIsAddingSlot(false);
  };

  // Filter slots for current active semester
  const semesterSlots = state.timetable.filter((s) => s.semesterId === state.activeSemesterId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5865D8] mb-1">
            College Timetable & Commitments
          </div>
          <h1 className="text-xl font-bold text-[#242938] flex items-center gap-2">
            <span>Weekly College Schedule</span>
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Distinguish fixed classes/labs from flexible windows. NEXORA protects your sleep and study buffers around these blocks.
          </p>
        </div>

        <button
          id="add-timetable-slot-btn"
          onClick={() => {
            setDayOfWeek(selectedDay);
            setIsAddingSlot(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Timetable Slot</span>
        </button>
      </div>

      {/* Add Slot Form Modal */}
      {isAddingSlot && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <h3 className="text-sm font-bold text-[#242938]">Add Recurring Timetable Block</h3>
            <button
              onClick={() => setIsAddingSlot(false)}
              className="text-xs text-[#667085] hover:text-[#242938] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[#667085] block mb-1">Block Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Operating Systems Lecture"
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  required
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Subject (Optional)</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                >
                  <option value="">-- No Specific Subject (e.g. Commute) --</option>
                  {state.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{DAY_NAMES[d]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Start Time (24h)</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  required
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">End Time (24h)</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  required
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Classroom / Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Hall 104 / Lab B12"
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Block Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as SlotType)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab / Practical</option>
                  <option value="tutorial">Tutorial / Discussion</option>
                  <option value="commute">Commute / Transit</option>
                  <option value="study_window">Flexible Study Window</option>
                  <option value="personal">Personal Commitment</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3 bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
                <input
                  type="checkbox"
                  id="isFixedCheckbox"
                  checked={isFixed}
                  onChange={(e) => setIsFixed(e.target.checked)}
                  className="w-4 h-4 accent-[#5865D8] cursor-pointer"
                />
                <label htmlFor="isFixedCheckbox" className="text-[#242938] cursor-pointer select-none">
                  <span className="font-semibold text-[#242938]">Fixed Commitment Block</span>
                  <p className="text-[11px] text-[#667085]">
                    If checked, NEXORA marks this time as unavailable for study sessions and adds transition buffers.
                  </p>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsAddingSlot(false)}
                className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#667085] hover:text-[#242938] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Save Block
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Day Selector Tabs */}
      <div className="grid grid-cols-7 gap-2 bg-white border border-[#E5E7EB] p-2 rounded-2xl shadow-xs">
        {DAYS_OF_WEEK.map((day) => {
          const count = semesterSlots.filter((s) => s.dayOfWeek === day).length;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`py-3 px-1 rounded-xl text-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#5865D8] text-white font-bold shadow-xs'
                  : 'text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA]'
              }`}
            >
              <div className="text-xs">{DAY_NAMES[day].slice(0, 3)}</div>
              <div className="text-[10px] mt-0.5 opacity-75">
                {count > 0 ? `${count} blocks` : 'Open'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Slots List for Selected Day */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5865D8]" />
            <h2 className="text-base font-bold text-[#242938]">
              {DAY_NAMES[selectedDay]} Schedule
            </h2>
          </div>
          <span className="text-xs text-[#667085]">
            {semesterSlots.filter((s) => s.dayOfWeek === selectedDay && s.isFixed).length} Fixed Commitments
          </span>
        </div>

        {(() => {
          const daySlots = semesterSlots
            .filter((s) => s.dayOfWeek === selectedDay)
            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

          if (daySlots.length === 0) {
            return (
              <div className="text-center py-12 space-y-2 text-[#667085]">
                <AlertCircle className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                <div className="text-xs font-semibold text-[#242938]">
                  No classes or commitments scheduled on {DAY_NAMES[selectedDay]}.
                </div>
                <p className="text-[11px] text-[#667085]">
                  This entire day is available as flexible time for deep project sprints, recovery, and self-study.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {daySlots.map((slot) => {
                const sub = state.subjects.find((s) => s.id === slot.subjectId);

                return (
                  <div
                    key={slot.id}
                    className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="text-center min-w-[70px] bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E7EB]">
                        <div className="text-xs font-mono font-bold text-[#242938]">{slot.startTime}</div>
                        <div className="text-[10px] font-mono text-[#667085]">{slot.endTime}</div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {sub && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: sub.color }}
                            >
                              {sub.code}
                            </span>
                          )}
                          <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded ${
                            slot.isFixed 
                              ? 'bg-[#FFFBEB] text-[#A6630A] border border-[#FDE68A]' 
                              : 'bg-[#ECFDF5] text-[#16845B] border border-[#A7F3D0]'
                          }`}>
                            {slot.isFixed ? 'Fixed Commitment' : 'Flexible Window'}
                          </span>
                          <span className="text-[10px] text-[#667085] capitalize">
                            • {slot.type}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-[#242938] truncate">
                          {slot.title}
                        </h3>

                        {slot.location && (
                          <div className="flex items-center gap-1 text-[11px] text-[#667085] mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{slot.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteSlot(slot.id)}
                      className="text-[#667085] hover:text-[#C43D4B] p-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
                      title="Delete slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
