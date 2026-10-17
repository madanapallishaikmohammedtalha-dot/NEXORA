import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  BookOpen, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Target, 
  Briefcase, 
  Code2, 
  Plus, 
  Trash2, 
  Moon, 
  Sun,
  Lock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  X,
  GraduationCap,
  Car
} from 'lucide-react';
import { 
  AppState, 
  AvailableStudyPeriod, 
  DayOfWeek, 
  Goal, 
  Semester, 
  Subject, 
  TimetableSlot,
  SkillProficiency,
  SkillWithLevel
} from '../types';
import { DAYS_OF_WEEK, DAY_NAMES } from '../services/scheduler';
import { 
  checkSlotConflict, 
  detectAllScheduleConflicts, 
  parseTimeToMinutes, 
} from '../services/validation';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (updatedState: Partial<AppState>) => void;
  onClose?: () => void;
  initialState: AppState;
}

interface LearningGoalFormItem {
  id: string;
  title: string;
  horizon: 'weekly' | 'semester' | 'career';
  targetValue: number;
  unit: string;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  onClose,
  initialState,
}) => {
  const isEditing = Boolean(initialState.profile.hasCompletedOnboarding);
  const [step, setStep] = useState<number>(1);
  const totalSteps = 7;

  // 1. Basic Profile & Bio-Rhythm
  const [name, setName] = useState(initialState.profile.name || 'Alex Mercer');
  const [university, setUniversity] = useState(initialState.profile.university || 'State Polytechnic University');
  const [degreeMajor, setDegreeMajor] = useState(initialState.profile.degreeMajor || 'Computer Science & Software Engineering');
  const [currentYear, setCurrentYear] = useState(initialState.profile.currentYear || 'Year 3 (Junior)');
  const [dailyCapacityMaxHours, setDailyCapacityMaxHours] = useState(initialState.profile.dailyCapacityMaxHours || 4.5);
  const [defaultBufferMinutes, setDefaultBufferMinutes] = useState(initialState.profile.defaultBufferMinutes || 15);
  const [wakeTime, setWakeTime] = useState(initialState.profile.wakeTime || '07:30');
  const [sleepTime, setSleepTime] = useState(initialState.profile.sleepTime || '23:30');
  const [travelTimeMinutes, setTravelTimeMinutes] = useState(initialState.profile.travelTimeMinutes || 30);

  // 2. Current Semester & Academic Dates
  const currentActiveSem = initialState.semesters.find((s) => s.id === initialState.activeSemesterId)
    || initialState.semesters.find((s) => s.isActive && s.status !== 'completed')
    || initialState.semesters[0];

  const [semesterName, setSemesterName] = useState(currentActiveSem?.name || 'Fall 2026 (Semester 5)');
  const [startDate, setStartDate] = useState(currentActiveSem?.startDate || '2026-09-01');
  const [expectedEndDate, setExpectedEndDate] = useState(currentActiveSem?.expectedEndDate || currentActiveSem?.endDate || '2026-12-20');
  const [actualEndDate, setActualEndDate] = useState(currentActiveSem?.actualEndDate || '');
  const [breakName, setBreakName] = useState(currentActiveSem?.holidays?.[0]?.name || 'Mid-Term Reading Week');
  const [breakStart, setBreakStart] = useState(currentActiveSem?.holidays?.[0]?.startDate || '2026-10-18');
  const [breakEnd, setBreakEnd] = useState(currentActiveSem?.holidays?.[0]?.endDate || '2026-10-25');

  // 3. College Schedule & Fixed Commitments
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>(() => {
    if (initialState.timetable && initialState.timetable.length > 0) {
      return initialState.timetable;
    }
    return [
      { id: 'tt-seed-1', semesterId: 'sem-active', title: 'Operating Systems (Lecture)', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:30', type: 'lecture', isFixed: true, location: 'Eng Hall 101' },
      { id: 'tt-seed-2', semesterId: 'sem-active', title: 'Algorithms & Complexity (Lecture)', dayOfWeek: 'tuesday', startTime: '11:00', endTime: '12:30', type: 'lecture', isFixed: true, location: 'Science Ctr 304' },
      { id: 'tt-seed-3', semesterId: 'sem-active', title: 'Computer Systems Lab (Practical)', dayOfWeek: 'wednesday', startTime: '14:00', endTime: '16:30', type: 'lab', isFixed: true, location: 'Lab B12' },
      { id: 'tt-seed-4', semesterId: 'sem-active', title: 'Database Systems (Lecture)', dayOfWeek: 'thursday', startTime: '10:00', endTime: '11:30', type: 'lecture', isFixed: true, location: 'Turing Aud' },
      { id: 'tt-seed-5', semesterId: 'sem-active', title: 'Campus Transit / Commute', dayOfWeek: 'friday', startTime: '08:15', endTime: '08:45', type: 'commute', isFixed: true, location: 'Transit Route 4' },
    ];
  });

  const [newSlotTitle, setNewSlotTitle] = useState('');
  const [newSlotDay, setNewSlotDay] = useState<DayOfWeek>('monday');
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:30');
  const [newSlotType, setNewSlotType] = useState<TimetableSlot['type']>('lecture');
  const [newSlotLocation, setNewSlotLocation] = useState('');
  const [slotConflictError, setSlotConflictError] = useState<string | null>(null);

  // 4. Flexible Availability & Study Windows
  const [studyPeriods, setStudyPeriods] = useState<AvailableStudyPeriod[]>(() => {
    if (initialState.studyPeriods && initialState.studyPeriods.length > 0) {
      return initialState.studyPeriods;
    }
    return [
      { id: 'sp-1', dayOfWeek: 'monday', startTime: '16:30', endTime: '19:00', label: 'Late Afternoon Deep Work' },
      { id: 'sp-2', dayOfWeek: 'wednesday', startTime: '17:00', endTime: '19:30', label: 'Midweek Study Window' },
      { id: 'sp-3', dayOfWeek: 'thursday', startTime: '16:00', endTime: '18:30', label: 'Evening Review Block' },
      { id: 'sp-4', dayOfWeek: 'saturday', startTime: '10:00', endTime: '13:00', label: 'Weekend Project Sprint' },
    ];
  });

  const [newPeriodDay, setNewPeriodDay] = useState<DayOfWeek>('tuesday');
  const [newPeriodStart, setNewPeriodStart] = useState('16:00');
  const [newPeriodEnd, setNewPeriodEnd] = useState('18:30');
  const [newPeriodLabel, setNewPeriodLabel] = useState('Evening Deep Work');
  const [periodConflictError, setPeriodConflictError] = useState<string | null>(null);

  // 5. Subjects & Curricular Load
  const [subjectsList, setSubjectsList] = useState<Subject[]>(() => {
    if (initialState.subjects && initialState.subjects.length > 0) {
      return initialState.subjects;
    }
    return [
      { id: 'sub-1', semesterId: 'sem-active', code: 'CS 301', name: 'Operating Systems & Concurrency', color: '#3B82F6', targetWeeklyHours: 5, credits: 4 },
      { id: 'sub-2', semesterId: 'sem-active', code: 'CS 302', name: 'Design & Analysis of Algorithms', color: '#10B981', targetWeeklyHours: 5, credits: 4 },
      { id: 'sub-3', semesterId: 'sem-active', code: 'CS 303', name: 'Computer Systems Architecture', color: '#8B5CF6', targetWeeklyHours: 4, credits: 3 },
      { id: 'sub-4', semesterId: 'sem-active', code: 'CS 304', name: 'Database Management Systems', color: '#F59E0B', targetWeeklyHours: 4, credits: 3 },
    ];
  });
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubHours, setNewSubHours] = useState(4);
  const [newSubColor, setNewSubColor] = useState('#3B82F6');

  // 6. Skills, Career & Learning Goals
  const [skillsList, setSkillsList] = useState<SkillWithLevel[]>(() => {
    if (initialState.profile.skillsWithLevels && initialState.profile.skillsWithLevels.length > 0) {
      return initialState.profile.skillsWithLevels;
    }
    if (initialState.profile.currentSkills && initialState.profile.currentSkills.length > 0) {
      return initialState.profile.currentSkills.map((s, idx) => ({
        name: s,
        level: idx === 0 ? 'advanced' : idx < 3 ? 'intermediate' : 'beginner',
      }));
    }
    return [
      { name: 'C / C++', level: 'advanced' },
      { name: 'Python', level: 'advanced' },
      { name: 'Data Structures & Algorithms', level: 'intermediate' },
      { name: 'Linux / Shell & Git', level: 'intermediate' },
      { name: 'SQL & Database Systems', level: 'beginner' },
    ];
  });
  const [customSkillName, setCustomSkillName] = useState('');
  const [customSkillLevel, setCustomSkillLevel] = useState<SkillProficiency>('intermediate');

  const [careerInterests, setCareerInterests] = useState<string[]>(
    initialState.profile.careerInterests || [
      'Operating Systems & Kernel Engineering',
      'High-Performance Distributed Systems',
    ]
  );
  const [newCareerInput, setNewCareerInput] = useState('');

  const [learningGoals, setLearningGoals] = useState<LearningGoalFormItem[]>(() => {
    if (initialState.goals && initialState.goals.length > 0) {
      return initialState.goals.map((g) => ({
        id: g.id,
        title: g.title,
        horizon: (g.horizon === 'weekly' || g.horizon === 'semester' || g.horizon === 'career') ? g.horizon : 'weekly',
        targetValue: g.targetValue || 10,
        unit: g.unit || 'hours',
      }));
    }
    return [
      {
        id: 'g-1',
        title: 'Complete 18 hrs of structured weekly deep work',
        horizon: 'weekly',
        targetValue: 18,
        unit: 'hours',
      },
      {
        id: 'g-2',
        title: 'Build POSIX multithreaded job worker with mutexes',
        horizon: 'semester',
        targetValue: 1,
        unit: 'project',
      },
      {
        id: 'g-3',
        title: 'Achieve 85%+ mastery in Operating Systems memory paging',
        horizon: 'semester',
        targetValue: 85,
        unit: '%',
      },
    ];
  });
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalHorizon, setNewGoalHorizon] = useState<'weekly' | 'semester' | 'career'>('weekly');
  const [newGoalTarget, setNewGoalTarget] = useState(15);
  const [newGoalUnit, setNewGoalUnit] = useState('hours');

  // Calculate sleep hours
  const calculatedSleepHours = useMemo(() => {
    const wake = parseTimeToMinutes(wakeTime);
    const sleep = parseTimeToMinutes(sleepTime);
    if (sleep > wake) {
      return Math.round(((1440 - sleep + wake) / 60) * 10) / 10;
    } else {
      return Math.round(((wake - sleep) / 60) * 10) / 10;
    }
  }, [wakeTime, sleepTime]);

  // Real-time schedule conflict audit
  const allDetectedConflicts = useMemo(() => {
    return detectAllScheduleConflicts(timetableSlots, studyPeriods, wakeTime, sleepTime);
  }, [timetableSlots, studyPeriods, wakeTime, sleepTime]);

  // Aggregate weekly metrics
  const totalWeeklyFixedMinutes = useMemo(() => {
    return timetableSlots.reduce((acc, s) => {
      const dur = parseTimeToMinutes(s.endTime) - parseTimeToMinutes(s.startTime);
      return acc + (dur > 0 ? dur : 0);
    }, 0);
  }, [timetableSlots]);

  const totalWeeklyFlexibleMinutes = useMemo(() => {
    return studyPeriods.reduce((acc, p) => {
      const dur = parseTimeToMinutes(p.endTime) - parseTimeToMinutes(p.startTime);
      return acc + (dur > 0 ? dur : 0);
    }, 0);
  }, [studyPeriods]);

  const totalWeeklyTargetStudyHours = useMemo(() => {
    return subjectsList.reduce((acc, s) => acc + (s.targetWeeklyHours || 0), 0);
  }, [subjectsList]);

  if (!isOpen) return null;

  // Handlers: Step 3 (Fixed Commitments)
  const handleAddSlot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSlotTitle.trim()) {
      setSlotConflictError('Please provide a title for the college commitment.');
      return;
    }

    const proposed = {
      dayOfWeek: newSlotDay,
      startTime: newSlotStart,
      endTime: newSlotEnd,
      isFixed: true,
      title: newSlotTitle.trim(),
    };

    const conflicts = checkSlotConflict(proposed, timetableSlots, studyPeriods, wakeTime, sleepTime);
    const blockingError = conflicts.find((c) => c.severity === 'error');
    if (blockingError) {
      setSlotConflictError(blockingError.message);
      return;
    }

    const newSlot: TimetableSlot = {
      id: `tt-${Date.now()}`,
      semesterId: 'sem-active',
      title: newSlotTitle.trim(),
      dayOfWeek: newSlotDay,
      startTime: newSlotStart,
      endTime: newSlotEnd,
      type: newSlotType,
      isFixed: true,
      location: newSlotLocation.trim() || undefined,
    };

    setTimetableSlots([...timetableSlots, newSlot]);
    setNewSlotTitle('');
    setNewSlotLocation('');
    setSlotConflictError(null);
  };

  const handleAddSlotPreset = (preset: { title: string; day: DayOfWeek; start: string; end: string; type: TimetableSlot['type']; location?: string }) => {
    const proposed = {
      dayOfWeek: preset.day,
      startTime: preset.start,
      endTime: preset.end,
      isFixed: true,
      title: preset.title,
    };
    const conflicts = checkSlotConflict(proposed, timetableSlots, studyPeriods, wakeTime, sleepTime);
    const blockingError = conflicts.find((c) => c.severity === 'error');
    if (blockingError) {
      setSlotConflictError(blockingError.message);
      return;
    }

    const slot: TimetableSlot = {
      id: `tt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      semesterId: 'sem-active',
      title: preset.title,
      dayOfWeek: preset.day,
      startTime: preset.start,
      endTime: preset.end,
      type: preset.type,
      isFixed: true,
      location: preset.location,
    };
    setTimetableSlots((prev) => [...prev, slot]);
    setSlotConflictError(null);
  };

  const handleRemoveSlot = (id: string) => {
    setTimetableSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers: Step 4 (Flexible Availability)
  const handleAddStudyPeriod = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const proposed = {
      dayOfWeek: newPeriodDay,
      startTime: newPeriodStart,
      endTime: newPeriodEnd,
      isFixed: false,
      title: newPeriodLabel.trim() || 'Study Window',
    };

    const conflicts = checkSlotConflict(proposed, timetableSlots, studyPeriods, wakeTime, sleepTime);
    const blockingError = conflicts.find((c) => c.severity === 'error');
    if (blockingError) {
      setPeriodConflictError(blockingError.message);
      return;
    }

    const period: AvailableStudyPeriod = {
      id: `sp-${Date.now()}`,
      dayOfWeek: newPeriodDay,
      startTime: newPeriodStart,
      endTime: newPeriodEnd,
      label: newPeriodLabel.trim() || 'Deep Work Focus',
    };

    setStudyPeriods([...studyPeriods, period]);
    setNewPeriodLabel('');
    setPeriodConflictError(null);
  };

  const handleAddPeriodPreset = (preset: { day: DayOfWeek; start: string; end: string; label: string }) => {
    const proposed = {
      dayOfWeek: preset.day,
      startTime: preset.start,
      endTime: preset.end,
      isFixed: false,
      title: preset.label,
    };
    const conflicts = checkSlotConflict(proposed, timetableSlots, studyPeriods, wakeTime, sleepTime);
    const blockingError = conflicts.find((c) => c.severity === 'error');
    if (blockingError) {
      setPeriodConflictError(blockingError.message);
      return;
    }

    const period: AvailableStudyPeriod = {
      id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      dayOfWeek: preset.day,
      startTime: preset.start,
      endTime: preset.end,
      label: preset.label,
    };
    setStudyPeriods((prev) => [...prev, period]);
    setPeriodConflictError(null);
  };

  const handleRemoveStudyPeriod = (id: string) => {
    setStudyPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  // Handlers: Step 5 (Subjects)
  const handleAddSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubCode.trim() || !newSubName.trim()) return;
    const newSub: Subject = {
      id: `sub-${Date.now()}`,
      semesterId: 'sem-active',
      code: newSubCode.trim().toUpperCase(),
      name: newSubName.trim(),
      color: newSubColor,
      targetWeeklyHours: Number(newSubHours) || 4,
      credits: 3,
    };
    setSubjectsList([...subjectsList, newSub]);
    setNewSubCode('');
    setNewSubName('');
  };

  const handleAddSubjectPreset = (preset: { code: string; name: string; hours: number; color: string }) => {
    if (subjectsList.some((s) => s.code.toUpperCase() === preset.code.toUpperCase())) return;
    const newSub: Subject = {
      id: `sub-${Date.now()}-${preset.code}`,
      semesterId: 'sem-active',
      code: preset.code,
      name: preset.name,
      color: preset.color,
      targetWeeklyHours: preset.hours,
      credits: 4,
    };
    setSubjectsList((prev) => [...prev, newSub]);
  };

  const handleRemoveSubject = (id: string) => {
    setSubjectsList((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers: Step 6 (Skills, Career, Goals)
  const handleAddSkill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customSkillName.trim()) return;
    if (skillsList.some((s) => s.name.toLowerCase() === customSkillName.trim().toLowerCase())) {
      setCustomSkillName('');
      return;
    }
    setSkillsList([...skillsList, { name: customSkillName.trim(), level: customSkillLevel }]);
    setCustomSkillName('');
  };

  const handleUpdateSkillLevel = (skillName: string, level: SkillProficiency) => {
    setSkillsList((prev) =>
      prev.map((s) => (s.name === skillName ? { ...s, level } : s))
    );
  };

  const handleRemoveSkill = (skillName: string) => {
    setSkillsList((prev) => prev.filter((s) => s.name !== skillName));
  };

  const handleAddCareerInterest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCareerInput.trim()) return;
    if (!careerInterests.includes(newCareerInput.trim())) {
      setCareerInterests([...careerInterests, newCareerInput.trim()]);
    }
    setNewCareerInput('');
  };

  const handleRemoveCareerInterest = (val: string) => {
    setCareerInterests((prev) => prev.filter((c) => c !== val));
  };

  const handleAddLearningGoal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newGoalTitle.trim()) return;
    const goal: LearningGoalFormItem = {
      id: `g-${Date.now()}`,
      title: newGoalTitle.trim(),
      horizon: newGoalHorizon,
      targetValue: Number(newGoalTarget) || 10,
      unit: newGoalUnit.trim() || 'hours',
    };
    setLearningGoals([...learningGoals, goal]);
    setNewGoalTitle('');
  };

  const handleRemoveLearningGoal = (id: string) => {
    setLearningGoals((prev) => prev.filter((g) => g.id !== id));
  };

  // Final Submit
  const handleFinalSubmit = () => {
    const existingSemesters = initialState.semesters || [];
    const activeSemesterId = initialState.activeSemesterId;
    const existingActiveSem = existingSemesters.find((s) => s.id === activeSemesterId);
    const targetSemId = existingActiveSem ? existingActiveSem.id : (activeSemesterId || `sem-${Date.now()}`);

    const updatedActiveSemester: Semester = {
      ...(existingActiveSem || {}),
      id: targetSemId,
      name: semesterName.trim() || existingActiveSem?.name || 'Current Semester',
      startDate,
      endDate: expectedEndDate,
      expectedEndDate,
      actualEndDate: actualEndDate.trim() || existingActiveSem?.actualEndDate || undefined,
      targetWeeklyStudyHours: totalWeeklyTargetStudyHours || 18,
      isActive: true,
      status: existingActiveSem?.status || 'active',
      holidays: breakName.trim()
        ? [
            {
              id: existingActiveSem?.holidays?.[0]?.id || `hol-${Date.now()}`,
              name: breakName.trim(),
              startDate: breakStart,
              endDate: breakEnd,
              type: 'break',
            },
            ...(existingActiveSem?.holidays?.slice(1) || []),
          ]
        : (existingActiveSem?.holidays || []),
    };

    // Preserve every existing completed semester and any historical terms
    let updatedSemestersList: Semester[];
    if (existingActiveSem) {
      updatedSemestersList = existingSemesters.map((s) => (s.id === targetSemId ? updatedActiveSemester : s));
    } else {
      updatedSemestersList = [...existingSemesters, updatedActiveSemester];
    }

    // Preserve subjects belonging to other historical semesters
    const otherSemesterSubjects = (initialState.subjects || []).filter((s) => s.semesterId !== targetSemId);
    const updatedTargetSubjects = subjectsList.map((s) => ({ ...s, semesterId: targetSemId }));
    const updatedSubjects = [...otherSemesterSubjects, ...updatedTargetSubjects];

    // Preserve timetable blocks belonging to other historical semesters
    const otherSemesterTimetable = (initialState.timetable || []).filter((s) => s.semesterId !== targetSemId);
    const updatedTargetTimetable = timetableSlots.map((s) => ({ ...s, semesterId: targetSemId }));
    const updatedTimetable = [...otherSemesterTimetable, ...updatedTargetTimetable];

    // Preserve existing goals and progress
    const existingGoalsMap = new Map((initialState.goals || []).map((g) => [g.id, g]));
    const mappedGoals: Goal[] = learningGoals.map((g, idx) => {
      const existing = existingGoalsMap.get(g.id);
      return {
        id: g.id.startsWith('g-') ? (existing ? existing.id : `goal-${Date.now()}-${idx}`) : g.id,
        semesterId: targetSemId,
        title: g.title,
        targetValue: g.targetValue,
        currentValue: existing?.currentValue || 0,
        unit: g.unit,
        horizon: g.horizon,
        status: existing?.status || 'active',
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
    });
    const otherSemesterGoals = (initialState.goals || []).filter((g) => g.semesterId && g.semesterId !== targetSemId);
    const updatedGoals = [...otherSemesterGoals, ...mappedGoals];

    onComplete({
      profile: {
        ...initialState.profile,
        name: name.trim(),
        university: university.trim(),
        degreeMajor: degreeMajor.trim(),
        currentYear,
        dailyCapacityMaxHours: Number(dailyCapacityMaxHours) || 4.5,
        defaultBufferMinutes: Number(defaultBufferMinutes) || 15,
        sleepHours: calculatedSleepHours || 8,
        travelTimeMinutes: Number(travelTimeMinutes) || 0,
        wakeTime,
        sleepTime,
        currentSkills: skillsList.map((s) => s.name),
        skillsWithLevels: skillsList,
        careerInterests,
        currentProjects: initialState.profile.currentProjects || ['POSIX Multithreaded Job Worker', 'LSM-Tree Key-Value Store'],
        hasCompletedOnboarding: true,
      },
      semesters: updatedSemestersList,
      activeSemesterId: targetSemId,
      subjects: updatedSubjects,
      timetable: updatedTimetable,
      studyPeriods,
      goals: updatedGoals,
    });
  };

  const stepsLabels = [
    'Profile & Rhythm',
    'Semester Dates',
    'College Schedule',
    'Flexible Availability',
    'Enrolled Subjects',
    'Skills & Goals',
    'Schedule Audit',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div 
        id="onboarding-modal-card"
        className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-[#242938] my-6 flex flex-col max-h-[90vh]"
      >
        {/* Progress Header */}
        <div className="bg-[#F5F6FA] px-5 py-3.5 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#5865D8] flex items-center justify-center font-bold text-white text-xs shadow-xs">
                NX
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                  <span>{isEditing ? 'Edit Academic Setup & Routine' : 'NEXORA Academic Onboarding'}</span>
                  {isEditing && (
                    <span className="text-[10px] bg-white text-[#5865D8] px-2 py-0.5 rounded border border-[#E5E7EB] font-medium">
                      Edit Mode
                    </span>
                  )}
                </h1>
                <p className="text-[11px] text-[#667085]">
                  Step {step} of {totalSteps} — {stepsLabels[step - 1]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing && onClose && (
                <button
                  onClick={onClose}
                  className="text-[#667085] hover:text-[#242938] p-1 rounded-lg hover:bg-[#E5E7EB] transition-colors"
                  title="Close without saving"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Clickable Step Pills */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {stepsLabels.map((label, idx) => {
              const stepNum = idx + 1;
              const isActive = step === stepNum;
              const isPast = step > stepNum;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(stepNum)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#5865D8]'
                      : isPast
                      ? 'bg-[#16845B]'
                      : 'bg-[#E5E7EB] hover:bg-[#D1D5DB]'
                  }`}
                  title={`Step ${stepNum}: ${label}`}
                />
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1 space-y-6">

          {/* STEP 1: Profile & Daily Biological Rhythm */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#5865D8]" />
                  <span>Student Profile & Biological Rhythm</span>
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  NEXORA grounds study schedules in your real biological rhythm, travel time, and sustainable cognitive bandwidth to prevent burnout.
                </p>
              </div>

              {/* Basic Profile Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="text-[#242938] font-medium block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Mercer"
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#242938] font-medium block mb-1">University / College</label>
                  <input
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="e.g. State Polytechnic University"
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#242938] font-medium block mb-1">Degree / Major</label>
                  <input
                    type="text"
                    value={degreeMajor}
                    onChange={(e) => setDegreeMajor(e.target.value)}
                    placeholder="e.g. Computer Science & Software Engineering"
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#242938] font-medium block mb-1">Current Academic Standing</label>
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  >
                    <option value="Year 1 (Freshman)">Year 1 (Freshman)</option>
                    <option value="Year 2 (Sophomore)">Year 2 (Sophomore)</option>
                    <option value="Year 3 (Junior)">Year 3 (Junior)</option>
                    <option value="Year 4 (Senior)">Year 4 (Senior)</option>
                    <option value="Graduate / Master's">Graduate / Master's</option>
                  </select>
                </div>
              </div>

              {/* Bio-Rhythm & Travel Section */}
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <span className="text-xs font-semibold text-[#242938] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5865D8]" />
                    <span>Protected Sleep & Commute Buffers</span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20 font-medium">
                    {calculatedSleepHours}h Sleep Protected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[#667085] block mb-1 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-[#A6630A]" />
                      <span>Wake Time</span>
                    </label>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-[#5865D8]" />
                      <span>Sleep Time</span>
                    </label>
                    <input
                      type="time"
                      value={sleepTime}
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-[#16845B]" />
                      <span>Commute / Travel Time</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={travelTimeMinutes}
                        onChange={(e) => setTravelTimeMinutes(Number(e.target.value))}
                        className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      />
                      <span className="text-[#667085] text-[11px]">min/trip</span>
                    </div>
                  </div>
                </div>

                {calculatedSleepHours < 6 && (
                  <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[11px] text-[#A6630A] flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Sleep duration is below 6 hours ({calculatedSleepHours}h). Consider increasing your rest window to safeguard cognitive retention.</span>
                  </div>
                )}
              </div>

              {/* Cognitive Capacity & Buffers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#242938] font-medium">Daily Max Study Cap</label>
                    <span className="text-[#5865D8] font-bold font-mono">{dailyCapacityMaxHours} hours/day</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={8}
                    step={0.5}
                    value={dailyCapacityMaxHours}
                    onChange={(e) => setDailyCapacityMaxHours(Number(e.target.value))}
                    className="w-full accent-[#5865D8] cursor-pointer"
                  />
                  <p className="text-[10px] text-[#667085] mt-1">
                    Academic recommendation: 3.5 to 5.0 hours of high-focus deep work per day.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#242938] font-medium">Inter-Block Buffer</label>
                    <span className="text-[#5865D8] font-bold font-mono">{defaultBufferMinutes} minutes</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={45}
                    step={5}
                    value={defaultBufferMinutes}
                    onChange={(e) => setDefaultBufferMinutes(Number(e.target.value))}
                    className="w-full accent-[#5865D8] cursor-pointer"
                  />
                  <p className="text-[10px] text-[#667085] mt-1">
                    Transition time allowed between classes, study sessions, and meals.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Current Semester & Dates */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5865D8]" />
                  <span>Current Semester & Term Timeline</span>
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Anchor your academic calendar so NEXORA paces syllabus topics accurately leading into exam season.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[#242938] font-medium block mb-1">Semester Name</label>
                  <input
                    type="text"
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                    placeholder="e.g. Fall 2026 (Semester 5)"
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#242938] font-medium block mb-1">Semester Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[#242938] font-medium block mb-1">Expected End Date (Exams Finish)</label>
                  <input
                    type="date"
                    value={expectedEndDate}
                    onChange={(e) => setExpectedEndDate(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#667085] block mb-1">
                    Actual End Date <span className="text-[10px] text-[#667085]">(Optional — filled when semester is completed)</span>
                  </label>
                  <input
                    type="date"
                    value={actualEndDate}
                    onChange={(e) => setActualEndDate(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                  />
                </div>
              </div>

              {/* Mid-term Reading Week / Break */}
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-semibold text-[#242938] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#5865D8]" />
                  <span>Mid-Term Break or Reading Week (Optional)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[#667085] block mb-1">Break Name</label>
                    <input
                      type="text"
                      value={breakName}
                      onChange={(e) => setBreakName(e.target.value)}
                      placeholder="e.g. Mid-Term Reading Week"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#667085] block mb-1">Break Start</label>
                    <input
                      type="date"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#667085] block mb-1">Break End</label>
                    <input
                      type="date"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: College Schedule & Fixed Commitments */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#A6630A]" />
                    <span>College Schedule & Fixed Commitments</span>
                  </h2>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#A6630A] font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Non-Negotiable Blocks</span>
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-1">
                  Fixed campus commitments (lectures, labs, tutorials, fixed commute) cannot be moved and directly deduct from your available study capacity.
                </p>
              </div>

              {/* Conflict Error Alert */}
              {slotConflictError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#C43D4B] flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#C43D4B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold block">Time Conflict Detected</span>
                    <span className="text-[#C43D4B]/90 text-[11px]">{slotConflictError}</span>
                  </div>
                  <button 
                    onClick={() => setSlotConflictError(null)}
                    className="text-[#C43D4B] hover:text-[#242938] text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider block mb-2">
                  Quick Add Common Campus Blocks:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSlotPreset({ title: 'Operating Systems Lecture', day: 'monday', start: '09:00', end: '10:30', type: 'lecture', location: 'Hall 101' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#5865D8]" />
                    <span>Mon OS Lecture (09:00-10:30)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSlotPreset({ title: 'Algorithms Lab Practical', day: 'tuesday', start: '14:00', end: '16:30', type: 'lab', location: 'Lab B12' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#5865D8]" />
                    <span>Tue Lab (14:00-16:30)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSlotPreset({ title: 'Database Systems Recitation', day: 'wednesday', start: '11:00', end: '12:30', type: 'tutorial', location: 'Room 204' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#5865D8]" />
                    <span>Wed Recitation (11:00-12:30)</span>
                  </button>
                </div>
              </div>

              {/* Add Custom Fixed Slot Form */}
              <form onSubmit={handleAddSlot} className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3 text-xs">
                <div className="font-semibold text-[#242938] flex items-center justify-between">
                  <span>Add Fixed Class / Lecture / Commitment</span>
                  <span className="text-[10px] text-[#A6630A] flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locks slot on timetable
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[#667085] block mb-1">Commitment Title</label>
                    <input
                      type="text"
                      value={newSlotTitle}
                      onChange={(e) => setNewSlotTitle(e.target.value)}
                      placeholder="e.g. Computer Networks Lecture"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1">Type</label>
                    <select
                      value={newSlotType}
                      onChange={(e) => setNewSlotType(e.target.value as any)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                    >
                      <option value="lecture">Lecture</option>
                      <option value="lab">Lab / Practical</option>
                      <option value="tutorial">Tutorial / Recitation</option>
                      <option value="commute">Fixed Transit / Commute</option>
                      <option value="personal">Fixed Personal Obligation</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1">Day of Week</label>
                    <select
                      value={newSlotDay}
                      onChange={(e) => setNewSlotDay(e.target.value as DayOfWeek)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] capitalize focus:border-[#5865D8] focus:outline-none"
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
                      value={newSlotStart}
                      onChange={(e) => setNewSlotStart(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1">End Time (24h)</label>
                    <input
                      type="time"
                      value={newSlotEnd}
                      onChange={(e) => setNewSlotEnd(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[#667085] block mb-1">Classroom / Location (Optional)</label>
                    <input
                      type="text"
                      value={newSlotLocation}
                      onChange={(e) => setNewSlotLocation(e.target.value)}
                      placeholder="e.g. Turing Hall 204"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Fixed Slot</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* List of Configured Fixed Commitments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#667085] font-medium">
                  <span>Enrolled Fixed Commitments ({timetableSlots.length})</span>
                  <span>{Math.round(totalWeeklyFixedMinutes / 60)} hrs / week</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {timetableSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#A6630A]">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <span className="font-semibold text-[#242938]">{slot.title}</span>
                          <div className="flex items-center gap-2 text-[11px] text-[#667085] mt-0.5">
                            <span className="capitalize text-[#242938] font-medium">{slot.dayOfWeek}</span>
                            <span>•</span>
                            <span className="font-mono text-[#242938]">{slot.startTime} – {slot.endTime}</span>
                            {slot.location && (
                              <>
                                <span>•</span>
                                <span>{slot.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(slot.id)}
                        className="text-[#667085] hover:text-[#C43D4B] p-1 rounded transition-colors cursor-pointer"
                        title="Remove commitment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Flexible Availability & Study Windows */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#16845B]" />
                    <span>Flexible Availability & Study Windows</span>
                  </h2>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#16845B] font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>Deep Work Zones</span>
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-1">
                  Designate recurring windows where you are free from college lectures and ready to study. NEXORA prioritizes scheduling study missions inside these blocks.
                </p>
              </div>

              {/* Conflict Error Alert */}
              {periodConflictError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#C43D4B] flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#C43D4B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold block">Schedule Clash Detected</span>
                    <span className="text-[#C43D4B]/90 text-[11px]">{periodConflictError}</span>
                  </div>
                  <button 
                    onClick={() => setPeriodConflictError(null)}
                    className="text-[#C43D4B] hover:text-[#242938] text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider block mb-2">
                  Quick Add Focus Windows:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddPeriodPreset({ day: 'tuesday', start: '17:00', end: '19:30', label: 'Tuesday Evening Focus' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#16845B]" />
                    <span>Tue Eve (17:00-19:30)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPeriodPreset({ day: 'friday', start: '15:00', end: '18:00', label: 'Friday Afternoon Deep Work' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#16845B]" />
                    <span>Fri Deep Work (15:00-18:00)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPeriodPreset({ day: 'saturday', start: '10:00', end: '13:00', label: 'Weekend Project Sprint' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#16845B]" />
                    <span>Sat Morning Sprint (10:00-13:00)</span>
                  </button>
                </div>
              </div>

              {/* Add Custom Study Period Form */}
              <form onSubmit={handleAddStudyPeriod} className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3 text-xs">
                <div className="font-semibold text-[#242938] flex items-center justify-between">
                  <span>Add Dedicated Study Window</span>
                  <span className="text-[10px] text-[#16845B] flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Flexible study availability
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[#667085] block mb-1">Window Name</label>
                    <input
                      type="text"
                      value={newPeriodLabel}
                      onChange={(e) => setNewPeriodLabel(e.target.value)}
                      placeholder="e.g. Library Afternoon Sprint"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1">Day of Week</label>
                    <select
                      value={newPeriodDay}
                      onChange={(e) => setNewPeriodDay(e.target.value as DayOfWeek)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] capitalize focus:border-[#5865D8] focus:outline-none"
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
                      value={newPeriodStart}
                      onChange={(e) => setNewPeriodStart(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1">End Time (24h)</label>
                    <input
                      type="time"
                      value={newPeriodEnd}
                      onChange={(e) => setNewPeriodEnd(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Flexible Study Window</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* List of Configured Study Windows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#667085] font-medium">
                  <span>Configured Study Windows ({studyPeriods.length})</span>
                  <span className="text-[#16845B] font-semibold">{Math.round(totalWeeklyFlexibleMinutes / 60)} hrs / week</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {studyPeriods.map((period) => (
                    <div
                      key={period.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#16845B]">
                          <Zap className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <span className="font-semibold text-[#242938]">{period.label || 'Study Window'}</span>
                          <div className="flex items-center gap-2 text-[11px] text-[#667085] mt-0.5">
                            <span className="capitalize text-[#242938] font-medium">{period.dayOfWeek}</span>
                            <span>•</span>
                            <span className="font-mono text-[#16845B]">{period.startTime} – {period.endTime}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveStudyPeriod(period.id)}
                        className="text-[#667085] hover:text-[#C43D4B] p-1 rounded transition-colors cursor-pointer"
                        title="Remove window"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Enrolled Subjects & Curricular Load */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#5865D8]" />
                    <span>Enrolled Subjects & Study Targets</span>
                  </h2>
                  <span className="text-xs text-[#667085] font-semibold">
                    Total: <strong className="text-[#5865D8]">{totalWeeklyTargetStudyHours} hrs/week</strong>
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-1">
                  Define your subjects and target study hours so daily study missions distribute effort fairly across all modules.
                </p>
              </div>

              {/* Subject Presets */}
              <div>
                <span className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider block mb-2">
                  1-Click Subject Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSubjectPreset({ code: 'CS 301', name: 'Operating Systems & Concurrency', hours: 5, color: '#3B82F6' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#5865D8]" />
                    <span>Operating Systems (CS 301)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubjectPreset({ code: 'CS 302', name: 'Algorithms & Complexity', hours: 5, color: '#10B981' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#16845B]" />
                    <span>Algorithms (CS 302)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubjectPreset({ code: 'CS 304', name: 'Database Management Systems', hours: 4, color: '#F59E0B' })}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3 text-[#A6630A]" />
                    <span>Databases (CS 304)</span>
                  </button>
                </div>
              </div>

              {/* Add Subject Form */}
              <form onSubmit={handleAddSubject} className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3 text-xs">
                <div className="font-semibold text-[#242938]">Enrol Custom Course</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[#667085] block mb-1">Course Code</label>
                    <input
                      type="text"
                      value={newSubCode}
                      onChange={(e) => setNewSubCode(e.target.value)}
                      placeholder="e.g. CS 305"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] uppercase font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[#667085] block mb-1">Course Title</label>
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      placeholder="e.g. Computer Networks & Protocols"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[#667085] block mb-1">Target Hours/Wk</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newSubHours}
                      onChange={(e) => setNewSubHours(Number(e.target.value))}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-4 flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#667085] text-[11px]">Badge Color:</span>
                      {['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewSubColor(col)}
                          className={`w-5 h-5 rounded-full border transition-all ${
                            newSubColor === col ? 'scale-125 border-[#242938]' : 'border-transparent opacity-70'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Course</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Subjects List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {subjectsList.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3 bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <div>
                        <div className="font-semibold text-[#242938]">{sub.code}: {sub.name}</div>
                        <div className="text-[11px] text-[#667085] mt-0.5">
                          {sub.targetWeeklyHours} hrs/week target
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(sub.id)}
                      className="text-[#667085] hover:text-[#C43D4B] p-1 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: Skills, Career Interests & Learning Goals */}
          {step === 6 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#5865D8]" />
                  <span>Skills, Career Interests & Learning Goals</span>
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  Tell NEXORA what you know, where you want to work, and what concrete milestones you want to achieve this semester.
                </p>
              </div>

              {/* Skill Levels Section */}
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#242938] flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-[#5865D8]" />
                    <span>Current Technical Skill Levels</span>
                  </span>
                  <span className="text-[10px] text-[#667085]">Select proficiency for each skill</span>
                </div>

                {/* Add Custom Skill */}
                <form onSubmit={handleAddSkill} className="flex gap-2 text-xs">
                  <input
                    type="text"
                    value={customSkillName}
                    onChange={(e) => setCustomSkillName(e.target.value)}
                    placeholder="Add a skill (e.g. Rust, Docker, Computer Networks)"
                    className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                  />
                  <select
                    value={customSkillLevel}
                    onChange={(e) => setCustomSkillLevel(e.target.value as SkillProficiency)}
                    className="bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#242938] capitalize focus:border-[#5865D8] focus:outline-none"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="proficient">Proficient</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg font-semibold cursor-pointer shadow-xs"
                  >
                    Add
                  </button>
                </form>

                {/* Skills Inventory Badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {skillsList.map((skill) => (
                    <div
                      key={skill.name}
                      className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs flex items-center gap-2 shadow-xs"
                    >
                      <span className="text-[#242938] font-medium">{skill.name}</span>
                      <select
                        value={skill.level}
                        onChange={(e) => handleUpdateSkillLevel(skill.name, e.target.value as SkillProficiency)}
                        className={`text-[10px] rounded px-1.5 py-0.5 border font-semibold capitalize cursor-pointer ${
                          skill.level === 'beginner'
                            ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#A6630A]'
                            : skill.level === 'intermediate'
                            ? 'bg-[#EEF0FF] border-[#5865D8]/20 text-[#5865D8]'
                            : skill.level === 'advanced'
                            ? 'bg-[#EEF0FF] border-[#5865D8]/40 text-[#5865D8]'
                            : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#16845B]'
                        }`}
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="proficient">Proficient</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.name)}
                        className="text-[#667085] hover:text-[#C43D4B] ml-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Career Interests Section */}
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3">
                <span className="text-xs font-semibold text-[#242938] flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#5865D8]" />
                  <span>Target Engineering Career Interests</span>
                </span>

                <form onSubmit={handleAddCareerInterest} className="flex gap-2 text-xs">
                  <input
                    type="text"
                    value={newCareerInput}
                    onChange={(e) => setNewCareerInput(e.target.value)}
                    placeholder="e.g. Distributed Systems Engineer, Linux Kernel Developer"
                    className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg font-semibold cursor-pointer shadow-xs"
                  >
                    Add
                  </button>
                </form>

                <div className="flex flex-wrap gap-2">
                  {careerInterests.map((interest) => (
                    <span
                      key={interest}
                      className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[#5865D8] rounded-lg text-xs flex items-center gap-1.5 shadow-xs font-medium"
                    >
                      <span>{interest}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCareerInterest(interest)}
                        className="text-[#667085] hover:text-[#C43D4B] cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Learning Goals Section */}
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#242938] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#5865D8]" />
                    <span>Measurable Learning Goals</span>
                  </span>
                  <span className="text-[10px] text-[#667085]">Weekly, semester or career horizons</span>
                </div>

                {/* Add Goal Form */}
                <form onSubmit={handleAddLearningGoal} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newGoalTitle}
                      onChange={(e) => setNewGoalTitle(e.target.value)}
                      placeholder="e.g. Build POSIX multithreaded job worker"
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <select
                      value={newGoalHorizon}
                      onChange={(e) => setNewGoalHorizon(e.target.value as any)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-[#242938] capitalize focus:border-[#5865D8] focus:outline-none"
                    >
                      <option value="weekly">Weekly Target</option>
                      <option value="semester">Semester Milestone</option>
                      <option value="career">Career Goal</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                      className="w-16 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-[#242938] font-mono text-center focus:border-[#5865D8] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newGoalUnit}
                      onChange={(e) => setNewGoalUnit(e.target.value)}
                      placeholder="unit"
                      className="w-16 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-[#242938] text-center focus:border-[#5865D8] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg font-semibold cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                  </div>
                </form>

                {/* List of Goals */}
                <div className="space-y-1.5">
                  {learningGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between p-2.5 bg-white border border-[#E5E7EB] rounded-lg text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="capitalize text-[10px] px-2 py-0.5 rounded bg-[#F5F6FA] text-[#667085] font-semibold border border-[#E5E7EB]">
                          {goal.horizon}
                        </span>
                        <span className="text-[#242938] font-medium">{goal.title}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[#5865D8] font-semibold text-[11px]">
                          Target: {goal.targetValue} {goal.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLearningGoal(goal.id)}
                          className="text-[#667085] hover:text-[#C43D4B] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Schedule Audit & Conflict Verification */}
          {step === 7 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E5E7EB] pb-3">
                <h2 className="text-sm font-bold text-[#242938] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16845B]" />
                  <span>Schedule Feasibility & Conflict Audit</span>
                </h2>
                <p className="text-xs text-[#667085] mt-1">
                  NEXORA checks every time boundary to verify that your fixed lectures, transit, flexible study windows, and sleep schedule do not clash.
                </p>
              </div>

              {/* Conflict Status Banner */}
              {allDetectedConflicts.length === 0 ? (
                <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#16845B] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#A7F3D0] flex items-center justify-center flex-shrink-0 text-[#16845B] shadow-xs">
                    <CheckCircle2 className="w-5 h-5 text-[#16845B]" />
                  </div>
                  <div>
                    <span className="font-bold text-[#16845B] text-sm block">0 Time Conflicts Detected</span>
                    <span className="text-[#16845B]/90 text-[11px]">
                      Your college commitments, transit buffers, study windows, and sleep schedule are completely clash-free and physically realistic!
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-[#C43D4B] font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-[#C43D4B]" />
                    <span>{allDetectedConflicts.length} Conflict(s) Need Attention</span>
                  </div>
                  <p className="text-[#667085] text-[11px]">
                    The following slots have overlapping time bounds or encroach upon protected sleep hours:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {allDetectedConflicts.map((c) => (
                      <div key={c.id} className="p-2 rounded bg-white border border-[#FECACA] text-[11px] text-[#C43D4B] flex items-center justify-between shadow-xs">
                        <div>
                          <span className="font-semibold capitalize text-[#A6630A]">[{c.dayOfWeek || 'Schedule'}]: </span>
                          <span>{c.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Schedule Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-3 rounded-xl text-center">
                  <span className="text-[11px] text-[#667085] block">Protected Sleep</span>
                  <span className="text-lg font-bold text-[#242938] font-mono">{calculatedSleepHours}h</span>
                  <span className="text-[10px] text-[#667085] block">{wakeTime} – {sleepTime}</span>
                </div>

                <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-3 rounded-xl text-center">
                  <span className="text-[11px] text-[#667085] block">Fixed Classes</span>
                  <span className="text-lg font-bold text-[#A6630A] font-mono">{Math.round(totalWeeklyFixedMinutes / 60)}h</span>
                  <span className="text-[10px] text-[#667085] block">{timetableSlots.length} commitments</span>
                </div>

                <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-3 rounded-xl text-center">
                  <span className="text-[11px] text-[#667085] block">Flexible Study</span>
                  <span className="text-lg font-bold text-[#16845B] font-mono">{Math.round(totalWeeklyFlexibleMinutes / 60)}h</span>
                  <span className="text-[10px] text-[#667085] block">{studyPeriods.length} windows</span>
                </div>

                <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-3 rounded-xl text-center">
                  <span className="text-[11px] text-[#667085] block">Target Study</span>
                  <span className="text-lg font-bold text-[#5865D8] font-mono">{totalWeeklyTargetStudyHours}h</span>
                  <span className="text-[10px] text-[#667085] block">{subjectsList.length} courses</span>
                </div>
              </div>

              {/* Visual Distinction: Fixed Commitments vs. Flexible Study Windows */}
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3 text-xs">
                <div className="font-semibold text-[#242938]">Commitment Distinction Map</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-white border border-[#E5E7EB] space-y-1 shadow-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#A6630A]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Fixed Commitments (Locked)</span>
                    </div>
                    <p className="text-[#667085]">
                      Campus lectures, laboratory sessions, recitations, and travel. These act as rigid constraints that NEXORA will never overwrite.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-[#E5E7EB] space-y-1 shadow-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#16845B]">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Flexible Availability (Study Zones)</span>
                    </div>
                    <p className="text-[#667085]">
                      Your designated deep work blocks. Daily study missions and revision tasks are placed inside these open windows.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ready Confirmation */}
              <div className="p-3.5 bg-white border border-[#E5E7EB] rounded-xl text-xs flex items-center justify-between shadow-xs">
                <div>
                  <span className="font-semibold text-[#242938] block">Save to Local Database</span>
                  <span className="text-[#667085] text-[11px]">
                    All settings and schedule constraints will be persisted locally in your browser and can be re-edited anytime.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="bg-[#F5F6FA] px-6 py-3.5 border-t border-[#E5E7EB] flex items-center justify-between flex-shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-xl text-xs font-medium cursor-pointer transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <span>Next: {stepsLabels[step]}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              id="complete-onboarding-btn"
              type="button"
              onClick={handleFinalSubmit}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save & Update Schedule' : 'Save & Launch NEXORA'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
