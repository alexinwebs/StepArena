import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const DEFAULT_DAILY_GOAL = 10000;
const DAILY_GOAL_PRESETS = [5000, 8000, 10000, 12000, 15000, 20000, 25000] as const;

type DailyActivity = {
  date: string;
  steps: number;
  goal?: number;
};

function isValidDailyGoal(value: number): boolean {
  return Number.isInteger(value) && value >= 1000 && value <= 100000;
}

function getEntryGoal(entry?: DailyActivity): number {
  const goal = entry?.goal ?? DEFAULT_DAILY_GOAL;
  return isValidDailyGoal(goal) ? goal : DEFAULT_DAILY_GOAL;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateStreak(history: DailyActivity[], todaySteps: number, todayGoal: number): number {
  const totals = new Map(history.map((entry) => [entry.date, entry]));
  const todayKey = localDateKey(new Date());
  totals.set(todayKey, { date: todayKey, steps: todaySteps, goal: todayGoal });

  const start = new Date();
  if ((totals.get(todayKey)?.steps ?? 0) < getEntryGoal(totals.get(todayKey))) {
    start.setDate(start.getDate() - 1);
  }

  let streak = 0;
  const cursor = new Date(start);
  while (true) {
    const entry = totals.get(localDateKey(cursor));
    if (!entry || entry.steps < getEntryGoal(entry)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const ACHIEVEMENTS = [
  { id: 'steps-1k', title: 'First Steps', description: 'Reach 1,000 steps in a day.', kind: 'steps', threshold: 1000 },
  { id: 'steps-5k', title: 'Halfway Hero', description: 'Reach 5,000 steps in a day.', kind: 'steps', threshold: 5000 },
  { id: 'steps-10k', title: '10K Club', description: 'Reach 10,000 steps in a day.', kind: 'steps', threshold: 10000 },
  { id: 'steps-25k', title: 'Trailblazer', description: 'Reach 25,000 steps in a day.', kind: 'steps', threshold: 25000 },
  { id: 'streak-3', title: 'On a Roll', description: 'Complete 3 consecutive daily goals.', kind: 'streak', threshold: 3 },
  { id: 'streak-7', title: 'Week of Wins', description: 'Complete 7 consecutive daily goals.', kind: 'streak', threshold: 7 },
  { id: 'streak-30', title: 'Unstoppable', description: 'Complete 30 consecutive daily goals.', kind: 'streak', threshold: 30 },
  { id: 'goals-7', title: 'Consistency Counts', description: 'Complete your daily goal on 7 days.', kind: 'goals', threshold: 7 },
] as const;

function countGoalDays(history: DailyActivity[], todaySteps: number, todayGoal: number): number {
  const today = localDateKey(new Date());
  const totals = new Map(history.map((entry) => [entry.date, entry]));
  totals.set(today, { date: today, steps: todaySteps, goal: todayGoal });
  return [...totals.values()].filter((entry) => entry.steps >= getEntryGoal(entry)).length;
}

function getUnlockedAchievementIds(
  steps: number,
  streakDays: number,
  goalDays: number,
): string[] {
  return ACHIEVEMENTS.filter((achievement) => {
    if (achievement.kind === 'steps') return steps >= achievement.threshold;
    if (achievement.kind === 'streak') return streakDays >= achievement.threshold;
    return goalDays >= achievement.threshold;
  }).map((achievement) => achievement.id);
}

function calculatePersonalRecords(history: DailyActivity[], todaySteps: number, todayGoal: number) {
  const today = localDateKey(new Date());
  const totals = new Map<string, DailyActivity>();

  history.forEach((entry) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isInteger(entry.steps) && entry.steps >= 0) {
      totals.set(entry.date, { date: entry.date, steps: entry.steps, goal: getEntryGoal(entry) });
    }
  });

  totals.set(today, { date: today, steps: todaySteps, goal: todayGoal });
  const entries = [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
  const dailyTotals = entries.map((entry) => entry.steps);
  const goalDays = entries.filter((entry) => entry.steps >= getEntryGoal(entry)).length;

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;
  for (const entry of entries) {
    const [year, month, day] = entry.date.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    const consecutive = previousDate !== null &&
      Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000) === 1;

    if (entry.steps >= getEntryGoal(entry)) {
      runningStreak = consecutive ? runningStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
    previousDate = currentDate;
  }

  return {
    totalSteps: dailyTotals.reduce((sum, steps) => sum + steps, 0),
    bestDay: dailyTotals.length ? Math.max(...dailyTotals) : 0,
    longestStreak,
    goalDays,
    recordedDays: entries.length,
  };
}

function buildActivityWeek(history: DailyActivity[], todaySteps: number, todayGoal: number, referenceDate = new Date()) {
  const todayKey = localDateKey(new Date());
  const byDate = new Map(history.map((entry) => [entry.date, entry]));
  byDate.set(todayKey, { date: todayKey, steps: todaySteps, goal: todayGoal });

  // The anchor date always occupies the fifth (center) position in the seven-point strip.
  // Browsing backward moves this anchor by whole seven-day intervals.
  const anchor = new Date(referenceDate);
  anchor.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index - 4);
    const key = localDateKey(date);
    const entry = byDate.get(key);
    const steps = entry?.steps ?? 0;
    const goal = getEntryGoal(entry);
    return {
      date: key,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      steps,
      goal,
      completed: steps >= goal,
      isToday: key === todayKey,
      isFuture: key > todayKey,
      hasRecord: Boolean(entry) || key === todayKey,
    };
  });
}

import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  AppState,
  NativeModules,
  PermissionsAndroid,
  Image,
  useColorScheme,
  Modal,
  TextInput,
} from 'react-native';

import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Award,
  ChartNoAxesColumn,
  Footprints,
  Heart,
  House,
  Moon,
  Plus,
  Settings,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react-native';

let INK = '#202024';
let PAPER = '#F5F4F1';
let WHITE = '#FBFAFB';
let MUTED = '#77746F';
const ORANGE = '#FF482F';
let LINE = '#E3E1DC';
let SURFACE = '#FFFFFF';
let DARK_SURFACE = '#202024';
let CHALLENGE_ACTION_SURFACE = '#202024';
let SOFT_SURFACE = '#EEECE7';
let TRACK = '#ECEAE6';
let AVATAR_SURFACE = '#E9E6E0';
let ACCENT_SOFT = '#FFF0EC';
let SEGMENT_SURFACE = '#ECEAE6';
let PROGRESS_TRACK = '#E8E6E1';
let RING_EMPTY = '#D9D6D0';

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    const browserAlert = (globalThis as any).alert;
    if (typeof browserAlert === 'function') {
      browserAlert(`${title}\n\n${message}`);
      return;
    }
  }

  Alert.alert(title, message);
}


type ThemePreference = 'system' | 'light' | 'dark';
type Tab = 'Home' | 'Compete' | 'Challenges' | 'Profile';

const tabs: { name: Tab; icon: any }[] = [
  { name: 'Home', icon: House },
  { name: 'Compete', icon: Trophy },
  { name: 'Challenges', icon: Heart },
  { name: 'Profile', icon: UserRound },
];

function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

function ProgressRing({
  progress,
  size = 150,
  animate,
}: {
  progress: number;
  size?: number;
  animate: boolean;
}) {
  const safeProgress = Math.max(0, Math.min(progress, 1));
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const listenerId = animatedProgress.addListener(({ value }) => {
      setDisplayProgress(value);
    });

    if (!animate) {
      animatedProgress.setValue(0);
      setDisplayProgress(0);
      return () => {
        animatedProgress.removeListener(listenerId);
      };
    }

    const animation = Animated.timing(animatedProgress, {
      toValue: safeProgress,
      duration: 1000,
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
      animatedProgress.removeListener(listenerId);
    };
  }, [animatedProgress, safeProgress, animate]);

  const dotCount = 48;
  const dotSize = Math.max(3, size * 0.025);
  const radius = (size - dotSize) / 2;
  const filledDots = Math.round(dotCount * displayProgress);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: dotCount }).map((_, i) => {
        const angle = (i / dotCount) * Math.PI * 2 - Math.PI / 2;
        const x = size / 2 + Math.cos(angle) * radius - dotSize / 2;
        const y = size / 2 + Math.sin(angle) * radius - dotSize / 2;

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor:
                displayProgress * dotCount >= i + 1 ? ORANGE : RING_EMPTY,
              opacity:
                displayProgress * dotCount >= i + 1
                  ? 1
                  : 0.85 + 0.15 * Math.max(
                      0,
                      1 - Math.abs(displayProgress * dotCount - (i + 1)) / 1.5,
                    ),
            }}
          />
        );
      })}
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercent}>
          {Math.round(displayProgress * 100)}%
        </Text>
        <Text style={styles.smallMuted}>of daily goal</Text>
      </View>
    </View>
  );
}

function Dots({ count = 7 }: { count?: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === count - 1 && styles.dotActive,
            i > count - 1 && styles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );
}

function Metric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.smallMuted}>{label}</Text>
    </View>
  );
}


function AnimatedNumber({
  value,
  style,
  animate,
}: {
  value: number;
  style?: any;
  animate: boolean;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: current }) => {
      setDisplayValue(Math.round(current));
    });

    if (!animate) {
      animatedValue.setValue(0);
      setDisplayValue(0);
      return () => {
        animatedValue.removeListener(listenerId);
      };
    }

    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration: 750,
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue, value, animate]);

  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={1}
      style={style}
      accessibilityLabel={`${value.toLocaleString('en-US')} steps`}
    >
      {displayValue.toLocaleString('en-US')}
    </Text>
  );
}

function HomeScreen({
  steps,
  weekData,
  activityHistory,
  streakDays,
  introComplete,
  goal,
  onGoalChange,
  dateLabel,
}: {
  steps: number;
  weekData: { date: string; day: string; steps: number; goal: number; completed: boolean; isToday: boolean; isFuture: boolean; hasRecord: boolean }[];
  activityHistory: DailyActivity[];
  streakDays: number;
  introComplete: boolean;
  goal: number;
  onGoalChange: (nextGoal: number) => void;
  dateLabel: string;
}) {
  const { width } = useWindowDimensions();
  const [showGoal, setShowGoal] = useState(false);
  const [customGoal, setCustomGoal] = useState(String(goal));
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hourlyData, setHourlyData] = useState<{ date: string; hours: number[]; hasData: boolean } | null>(null);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  // A single native-driven value animates the selected day. The seven columns
  // themselves never change width, so selecting a day cannot reflow the row.
  const selectedDayProgress = useRef(new Animated.Value(0)).current;
  const weekDetailHeight = useRef(new Animated.Value(0)).current;
  const weekBarEntranceValues = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(0)),
  ).current;
  const hourlyBarValues = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    hourlyBarValues.forEach((value) => {
      value.stopAnimation();
      value.setValue(0);
    });

    if (!selectedDate || hourlyData?.date !== selectedDate || !hourlyData.hasData) {
      return;
    }

    const activeAnimations = hourlyData.hours
      .map((count, hour) => {
        if (count <= 0) return null;

        return Animated.timing(hourlyBarValues[hour], {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
      })
      .filter((animation): animation is Animated.CompositeAnimation => animation !== null);

    if (activeAnimations.length > 0) {
      Animated.stagger(26, activeAnimations).start();
    }

    return () => {
      hourlyBarValues.forEach((value) => value.stopAnimation());
    };
  }, [selectedDate, hourlyData?.date, hourlyData?.hours, hourlyData?.hasData]);
  const animateSelectedDay = (next: number, onFinished?: () => void) => {
    const duration = next === 1 ? 260 : 210;
    const easing = next === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);

    Animated.parallel([
      Animated.timing(selectedDayProgress, {
        toValue: next,
        duration,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(weekDetailHeight, {
        toValue: next === 1 ? 112 : 0,
        duration,
        easing,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) onFinished?.();
    });
  };

  // Start the entrance only after the selected day's animated views mount.
  useEffect(() => {
    if (selectedDate) {
      animateSelectedDay(1);
    }
  }, [selectedDate]);


  useEffect(() => {
    let active = true;
    setHourlyData(null);
    if (!selectedDate) {
      setHourlyLoading(false);
      return () => { active = false; };
    }

    const stepCounter = NativeModules.StepCounter as
      | { getHourlySteps?: (date: string) => Promise<{ date: string; hours: number[]; hasData: boolean }> }
      | undefined;

    if (Platform.OS !== 'android' || !stepCounter?.getHourlySteps) {
      setHourlyLoading(false);
      return () => { active = false; };
    }

    setHourlyLoading(true);
    stepCounter.getHourlySteps(selectedDate)
      .then((result) => {
        if (!active || result.date !== selectedDate) return;
        const safeHours = Array.from({ length: 24 }, (_, index) => {
          const value = Number(result.hours?.[index] ?? 0);
          return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
        });
        setHourlyData({ date: result.date, hours: safeHours, hasData: Boolean(result.hasData) });
      })
      .catch((error) => {
        console.warn('Could not load hourly activity:', error);
        if (active) setHourlyData(null);
      })
      .finally(() => {
        if (active) setHourlyLoading(false);
      });

    return () => { active = false; };
  }, [selectedDate]);

  const todayKey = localDateKey(new Date());
  const formatShortDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const shiftedWeekData = (() => {
    // Keep the anchor (today, or the same weekday in a browsed week) at point five.
    const reference = new Date();
    reference.setDate(reference.getDate() + weekOffset * 7);
    return buildActivityWeek(activityHistory, steps, goal, reference);
  })();
  const weekStart = shiftedWeekData[0]?.date ?? todayKey;
  const weekEnd = shiftedWeekData[6]?.date ?? todayKey;
  const selectedDay = shiftedWeekData.find((item) => item.date === selectedDate);
  const visibleDays = shiftedWeekData.filter((item) => item.date <= todayKey && item.hasRecord);
  const completedDays = visibleDays.filter((item) => item.completed).length;
  const averageSteps = visibleDays.length ? Math.round(visibleDays.reduce((sum, item) => sum + item.steps, 0) / visibleDays.length) : 0;

  // Animate the weekly meter only when Home is visible. HomeScreen is unmounted
  // when leaving the tab, so returning to Home naturally replays this entrance.
  // On cold launch, wait until the intro overlay has finished.
  useEffect(() => {
    if (!introComplete) return;

    weekBarEntranceValues.forEach((value) => value.setValue(0));
    const entrance = Animated.stagger(
      65,
      shiftedWeekData.map((item, index) =>
        Animated.timing(weekBarEntranceValues[index], {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ),
    );

    entrance.start();
    return () => entrance.stop();
  }, [introComplete, weekOffset]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.topBar}>
        <View>
          <Label>TODAY</Label>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adjust daily goal"
          onPress={() => {
            setCustomGoal(String(goal));
            setShowGoal(true);
          }}
          style={({ pressed }) => [
            styles.roundButton,
            pressed && styles.pressed,
          ]}
        >
          <Plus size={21} color={INK} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.stepLabelRow}>
          <Footprints size={17} color={ORANGE} />
          <Label>DAILY MOVEMENT</Label>
        </View>
        <AnimatedNumber value={steps} style={styles.bigSteps} animate={introComplete} />
        <Text style={styles.goalCaption}>
          STEPS WALKED TODAY
        </Text>


        <View style={styles.progressSection}>
          <ProgressRing progress={Math.min(steps / goal, 1)} size={width * 0.42} animate={introComplete} />
          <View style={styles.progressCopy}>
            <Label>REMAINING TODAY</Label>
            <Text style={styles.remaining}>
              {Math.max(goal - steps, 0).toLocaleString('en-US')}
            </Text>
            <Text style={styles.smallMuted}>steps remaining</Text>
            <View style={styles.thinLine} />
            <Text style={styles.progressNote}>
              {steps >= goal ? 'Daily goal completed ✓' : 'Keep your momentum.'}
            </Text>
          </View>
        </View>
      </View>


      <View style={[styles.sectionHeading, { marginBottom: 12 }]}>
        <Text style={styles.sectionTitle}>Your week</Text>
        <View style={styles.weekNavigator}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => { setWeekOffset((value) => value - 1); setSelectedDate(null); selectedDayProgress.setValue(0); weekDetailHeight.setValue(0); }} style={styles.weekArrow}>
            <ChevronLeft size={17} color={INK} />
          </Pressable>
          <Text style={styles.weekRange}>{formatShortDate(weekStart)} – {formatShortDate(weekEnd)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={weekOffset >= 0} onPress={() => { setWeekOffset((value) => Math.min(0, value + 1)); setSelectedDate(null); selectedDayProgress.setValue(0); weekDetailHeight.setValue(0); }} style={[styles.weekArrow, weekOffset >= 0 && { opacity: 0.28 }]}>
            <ChevronRight size={17} color={INK} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekCard}>
        <View style={styles.weekPointsRow}>
          {shiftedWeekData.map((item, index) => {
            const maxSteps = Math.max(DEFAULT_DAILY_GOAL, ...shiftedWeekData.map((entry) => Math.max(entry.goal, entry.steps)));
            const height = item.steps === 0 ? 0 : Math.max(5, (item.steps / maxSteps) * 100);
            const selected = selectedDate === item.date;
            const fixedPoint = index === 4;
            const progress = item.hasRecord ? Math.min(item.steps / Math.max(item.goal, 1), 1) : 0;
            const selectDay = () => {
              if (selected) {
                animateSelectedDay(0, () => setSelectedDate(null));
              } else {
                selectedDayProgress.setValue(0);
                setSelectedDate(item.date);
              }
            };
            const barScale = selected
              ? selectedDayProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] })
              : 1;
            return (
              <View key={item.date} style={styles.weekColumnAnimated}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${formatShortDate(item.date)}, ${item.hasRecord ? `${item.steps.toLocaleString('en-US')} steps` : 'no saved activity'}`}
                  disabled={item.isFuture}
                  onPress={selectDay}
                  style={({ pressed }) => [styles.weekColumn, pressed && styles.weekColumnPressed]}
                >
                  <View style={styles.weekColumnTop}>
                    <Text style={[styles.weekDay, fixedPoint && styles.anchorDay, item.isToday && { color: ORANGE, fontWeight: '800' }, selected && { color: ORANGE }]}>{item.day}</Text>
                    <Animated.View style={{ transform: [{ scaleX: barScale }] }}>
                      <View style={styles.barTrack}>
                        <Animated.View
                          style={[
                            styles.bar,
                            {
                              height: weekBarEntranceValues[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', `${height}%`],
                              }),
                              backgroundColor: item.isToday || item.completed ? ORANGE : INK,
                              opacity: item.isFuture ? 0.18 : 1,
                            },
                          ]}
                        />
                      </View>
                    </Animated.View>
                    <Text style={[styles.weekStepsTiny, selected && { color: ORANGE, fontWeight: '800' }]}>{item.hasRecord ? `${Math.round(progress * 100)}%` : '—'}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
        <Animated.View
          style={[
            styles.weekDetailSlot,
            {
              height: weekDetailHeight,
              marginTop: weekDetailHeight.interpolate({
                inputRange: [0, 112],
                outputRange: [0, 8],
              }),
              paddingTop: weekDetailHeight.interpolate({
                inputRange: [0, 112],
                outputRange: [0, 8],
              }),
              borderTopWidth: weekDetailHeight.interpolate({
                inputRange: [0, 112],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          {selectedDay ? (
            <Animated.View
              pointerEvents="auto"
              style={[styles.weekDetailContent, {
                opacity: selectedDayProgress,
                transform: [{ translateY: selectedDayProgress.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
              }]}
            >
              <View style={styles.weekDetailHeading}>
                <View style={styles.weekDetailStats}>
                  <Text style={styles.expandedDayDate}>{formatShortDate(selectedDay.date)}</Text>
                  <Text style={styles.expandedDaySteps}>{selectedDay.hasRecord ? selectedDay.steps.toLocaleString('en-US') : '—'}</Text>
                  <Text style={styles.expandedDayCaption}>STEPS · {selectedDay.hasRecord ? `${Math.round((selectedDay.steps / Math.max(selectedDay.goal, 1)) * 100)}% OF GOAL` : 'NO SAVED DATA'}</Text>
                  <View style={styles.expandedDayGoalRow}>
                    <Text style={styles.expandedDayCaption}>DAILY GOAL</Text>
                    <Text style={styles.expandedDayGoal}>{selectedDay.goal.toLocaleString('en-US')}</Text>
                  </View>
                </View>
                <View style={styles.weekDetailHourly}>
                  {selectedDay.hasRecord && hourlyData?.date === selectedDay.date && hourlyData.hasData ? (
                    <View style={styles.miniHourlyBars}>
                      {hourlyData.hours.map((count, hour) => {
                        const peak = Math.max(1, ...hourlyData.hours);
                        const peakHour = count > 0 && count === peak;
                        const targetHeight = count > 0 ? Math.max(9, (count / peak) * 100) : 0;
                        return (
                          <View key={hour} style={styles.miniHourlyTrack}>
                            <Animated.View
                              style={[
                                styles.miniHourlyBar,
                                {
                                  height: hourlyBarValues[hour].interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', `${targetHeight}%`],
                                  }),
                                  backgroundColor: peakHour ? ORANGE : MUTED,
                                },
                              ]}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.expandedDayHint}>{selectedDay.hasRecord ? (hourlyLoading ? 'Loading hourly data…' : 'Hourly data unavailable') : 'No saved data'}</Text>
                  )}
                  <Text style={styles.expandedDayCaption}>HOURLY ACTIVITY</Text>
                </View>
              </View>
            </Animated.View>
          ) : (
            <Text style={styles.weekDetailPlaceholder}>Select a day to view its activity</Text>
          )}
        </Animated.View>
      </View>
      <View style={styles.weekSummary}>
        <View><Text style={styles.weekSummaryValue}>{completedDays}/{visibleDays.length}</Text><Text style={styles.smallMuted}>GOALS REACHED</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={styles.weekSummaryValue}>{averageSteps.toLocaleString('en-US')}</Text><Text style={styles.smallMuted}>AVG. STEPS / DAY</Text></View>
      </View>


      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Activity streak</Text>
        <Activity size={18} color={ORANGE} />
      </View>
      <View style={styles.streakCard}>
        <View>
          <Text style={styles.streakNumber}>{String(streakDays).padStart(2, "0")} DAYS</Text>
          <Text style={styles.smallMuted}>Consecutive days meeting your target.</Text>
        </View>
        <Dots />
      </View>

      <Modal visible={showGoal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowGoal(false)}>
        <View style={styles.goalModalBackdrop}>
          <View style={styles.goalModalCard}>
            <Text style={styles.smallMuted}>PERSONALISE YOUR ACTIVITY</Text>
            <Text style={styles.goalModalTitle}>Daily step goal</Text>
            <Text style={styles.smallMuted}>Your new target applies from today. Previous days keep their original goal.</Text>
            <View style={styles.goalPresetGrid}>
              {DAILY_GOAL_PRESETS.map((preset) => {
                const selected = goal === preset;
                return (
                  <Pressable
                    key={preset}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => { onGoalChange(preset); setShowGoal(false); }}
                    style={[styles.goalPreset, selected && styles.goalPresetSelected]}
                  >
                    <Text style={[styles.goalPresetText, selected && styles.goalPresetTextSelected]}>
                      {(preset / 1000).toLocaleString('en-US')}K
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.smallMuted}>CUSTOM TARGET · 1,000–100,000</Text>
            <TextInput
              accessibilityLabel="Custom daily step goal"
              value={customGoal}
              onChangeText={setCustomGoal}
              keyboardType="number-pad"
              placeholder="Enter steps"
              placeholderTextColor={MUTED}
              maxLength={6}
              style={styles.goalInput}
            />
            <View style={styles.goalModalActions}>
              <Pressable onPress={() => setShowGoal(false)} style={styles.goalCancelButton}>
                <Text style={styles.goalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const parsed = Number(customGoal);
                  if (!isValidDailyGoal(parsed)) {
                    showMessage('Invalid goal', 'Enter a whole number between 1,000 and 100,000 steps.');
                    return;
                  }
                  onGoalChange(parsed);
                  setShowGoal(false);
                }}
                style={styles.goalSaveButton}
              >
                <Text style={styles.goalSaveText}>Save goal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function CompeteScreen() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Label>THE ARENA</Label>
      <Text style={styles.pageTitle}>Compete.</Text>
      <Text style={styles.pageSubtitle}>Your activity stays yours until real competition is available.</Text>

      <View style={[styles.rankCard, { marginTop: 8, paddingVertical: 26, gap: 12 }]}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT_SOFT, alignItems: 'center', justifyContent: 'center' }}>
          <Trophy size={22} color={ORANGE} />
        </View>
        <Text style={styles.sectionTitle}>Leaderboards are coming later</Text>
        <Text style={styles.smallMuted}>
          Global rankings and friend competitions need real accounts and a secure online service. No sample players or invented scores are shown here.
        </Text>
      </View>
    </ScrollView>
  );
}

function ChallengesScreen({
  steps,
  streakDays,
  goalDays,
  earnedBadgeIds,
  dailyGoal,
}: {
  steps: number;
  streakDays: number;
  goalDays: number;
  earnedBadgeIds: string[];
  dailyGoal: number;
}) {
  const [selectedAchievement, setSelectedAchievement] =
    useState<(typeof ACHIEVEMENTS)[number] | null>(null);
  const progress = Math.min(steps / dailyGoal, 1);
  const completed = steps >= dailyGoal;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Label>YOUR PERSONAL MILESTONES</Label>
      <Text style={styles.pageTitle}>Challenges.</Text>
      <Text style={styles.pageSubtitle}>Build consistency against your own daily target.</Text>

      <View style={styles.challengeCard}>
        <Label>TODAY'S TARGET</Label>
        <Text style={styles.challengeTitle}>{dailyGoal.toLocaleString('en-US')} steps</Text>
        <View style={styles.challengeDots}>
          <View style={styles.challengeProgressTrack}>
            <View style={[styles.challengeProgressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.challengeProgress}>
            {steps.toLocaleString('en-US')} / {dailyGoal.toLocaleString('en-US')}
          </Text>
        </View>
        <Text style={[styles.smallMuted, { marginTop: 8 }]}>
          {completed ? 'Daily target completed.' : `${Math.max(dailyGoal - steps, 0).toLocaleString('en-US')} steps to go`}
        </Text>
        <View style={styles.thinLine} />
        <View style={styles.inlineBetween}>
          <Text style={styles.smallMuted}>Current streak</Text>
          <Text style={styles.personName}>{streakDays} {streakDays === 1 ? 'day' : 'days'}</Text>
        </View>
        <View style={styles.inlineBetween}>
          <Text style={styles.smallMuted}>Goal days recorded</Text>
          <Text style={styles.personName}>{goalDays}</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Your achievements</Text>
        <Award color={ORANGE} size={19} />
      </View>
      <View style={{ gap: 10 }}>
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = earnedBadgeIds.includes(achievement.id);
          const progressValue =
            achievement.kind === 'steps'
              ? steps
              : achievement.kind === 'streak'
                ? streakDays
                : goalDays;
          const progress = unlocked ? 1 : Math.min(progressValue / achievement.threshold, 1);

          return (
            <Pressable
              key={achievement.id}
              accessibilityRole="button"
              accessibilityLabel={`${achievement.title}, ${unlocked ? 'unlocked' : `${Math.round(progress * 100)} percent complete`}`}
              onPress={() => setSelectedAchievement(achievement)}
              style={({ pressed }) => [
                styles.achievementRow,
                { backgroundColor: SURFACE, borderRadius: 14, padding: 12 },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.achievementCircle,
                  { backgroundColor: unlocked ? ACCENT_SOFT : TRACK },
                ]}
              >
                {achievement.kind === 'streak' ? (
                  <Trophy size={20} color={unlocked ? ORANGE : MUTED} />
                ) : (
                  <Footprints size={20} color={unlocked ? ORANGE : MUTED} />
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.personName}>{achievement.title}</Text>
                <Text style={styles.smallMuted}>{achievement.description}</Text>
                <View
                  style={{
                    height: 4,
                    backgroundColor: TRACK,
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      width: `${progress * 100}%`,
                      backgroundColor: unlocked ? ORANGE : MUTED,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
              <Text
                style={[
                  styles.achievementStatus,
                  { color: unlocked ? ORANGE : MUTED, fontWeight: '700' },
                ]}
              >
                {unlocked ? 'UNLOCKED' : `${Math.round(progress * 100)}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedAchievement && (() => {
        const achievement = selectedAchievement;
        const unlocked = earnedBadgeIds.includes(achievement.id);
        const currentValue =
          achievement.kind === 'steps'
            ? steps
            : achievement.kind === 'streak'
              ? streakDays
              : goalDays;
        const progress = unlocked ? 1 : Math.min(currentValue / achievement.threshold, 1);
        const unit =
          achievement.kind === 'steps'
            ? 'steps'
            : achievement.kind === 'streak'
              ? 'days'
              : 'goal days';

        return (
          <Modal
            visible={!!selectedAchievement}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setSelectedAchievement(null)}
          >
            <View
              accessibilityViewIsModal
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.58)',
                justifyContent: 'center',
                padding: 22,
              }}
            >
            <View
              style={{
                backgroundColor: SURFACE,
                borderRadius: 22,
                padding: 24,
                borderWidth: 1,
                borderColor: LINE,
                gap: 16,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close achievement details"
                onPress={() => setSelectedAchievement(null)}
                style={({ pressed }) => [
                  { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.smallMuted}>← BACK TO ACHIEVEMENTS</Text>
              </Pressable>

              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: unlocked ? ACCENT_SOFT : TRACK,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {achievement.kind === 'streak' ? (
                  <Trophy size={34} color={unlocked ? ORANGE : MUTED} />
                ) : (
                  <Footprints size={34} color={unlocked ? ORANGE : MUTED} />
                )}
              </View>

              <Label>ACHIEVEMENT DETAIL</Label>
              <Text style={styles.challengeTitle}>{achievement.title}</Text>
              <Text style={styles.smallMuted}>{achievement.description}</Text>

              <Text
                style={{
                  color: unlocked ? ORANGE : MUTED,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                }}
              >
                {unlocked ? '✓  UNLOCKED' : 'IN PROGRESS'}
              </Text>

              <View style={{ gap: 9 }}>
                <View
                  style={{
                    height: 7,
                    backgroundColor: TRACK,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 7,
                      width: `${progress * 100}%`,
                      backgroundColor: ORANGE,
                      borderRadius: 8,
                    }}
                  />
                </View>
                <View style={styles.inlineBetween}>
                  <Text style={styles.smallMuted}>
                    {(unlocked ? achievement.threshold : Math.min(currentValue, achievement.threshold)).toLocaleString('en-US')} / {achievement.threshold.toLocaleString('en-US')} {unit}
                  </Text>
                  <Text style={styles.personName}>{Math.round(progress * 100)}%</Text>
                </View>
              </View>

              <View style={styles.thinLine} />

              <Text style={styles.smallMuted}>
                {unlocked
                  ? 'You earned this achievement. Keep moving toward your next milestone.'
                  : `Reach ${achievement.threshold.toLocaleString('en-US')} ${unit} to unlock this achievement.`}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedAchievement(null)}
                style={({ pressed }) => [
                  styles.challengeJoinButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.challengeJoinText}>Done</Text>
                <ArrowRight size={17} color={WHITE} />
              </Pressable>
            </View>
          </View>
        </Modal>
        );
      })()}
    </ScrollView>
  );
}

function ProfileScreen({
  earnedBadgeIds,
  records,
  appearance,
  onAppearancePress,
  onActivityHistoryPress,
  onAchievementsPress,
  onHealthPreferencesPress,
  onSettingsPress,
}: {
  earnedBadgeIds: string[];
  records: ReturnType<typeof calculatePersonalRecords>;
  appearance: ThemePreference;
  onAppearancePress: () => void;
  onActivityHistoryPress: () => void;
  onAchievementsPress: () => void;
  onHealthPreferencesPress: () => void;
  onSettingsPress: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <Label>YOUR SPACE</Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={onSettingsPress}
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
        >
          <Settings size={20} color={INK} />
        </Pressable>
      </View>

      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}>
          <UserRound size={29} color={INK} />
        </View>
        <View style={styles.profileHeroCopy}>
          <Text style={styles.profileName}>StepArena</Text>
          <Text style={styles.profileHandle}>PERSONAL ACTIVITY</Text>
        </View>
      </View>

      <View style={styles.profileAchievements}>
        <View style={styles.profileAchievementsHeading}>
          <View>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Text style={styles.smallMuted}>
              {earnedBadgeIds.length} earned
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all achievements"
            onPress={onAchievementsPress}
            style={({ pressed }) => [
              styles.profileViewAll,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.profileViewAllText}>View all</Text>
            <ArrowRight size={15} color={ORANGE} />
          </Pressable>
        </View>

        {earnedBadgeIds.length > 0 ? (
          <View style={styles.profileBadgeList}>
            {ACHIEVEMENTS
              .filter((achievement) => earnedBadgeIds.includes(achievement.id))
              .slice(0, 3)
              .map((achievement) => (
                <View key={achievement.id} style={styles.profileBadgeItem}>
                  <View style={styles.profileBadgeIcon}>
                    {achievement.kind === 'streak' ? (
                      <Trophy size={19} color={ORANGE} />
                    ) : (
                      <Footprints size={19} color={ORANGE} />
                    )}
                  </View>
                  <Text
                    style={styles.profileBadgeTitle}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {achievement.title}
                  </Text>
                </View>
              ))}
          </View>
        ) : (
          <View style={styles.profileEmptyAchievements}>
            <Text style={styles.smallMuted}>
              Your first milestone is waiting. Keep moving to earn a badge.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Personal records</Text>
        <Trophy color={ORANGE} size={19} />
      </View>

      <View
        style={{
          backgroundColor: SURFACE,
          borderRadius: 17,
          padding: 17,
          gap: 15,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>TOTAL STEPS</Text>
            <Text style={styles.recordPrimaryValue}>
              {records.totalSteps.toLocaleString('en-US')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>BEST DAY</Text>
            <Text style={styles.recordPrimaryValue}>
              {records.bestDay.toLocaleString('en-US')}
            </Text>
          </View>
        </View>

        <View style={styles.thinLine} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>LONGEST STREAK</Text>
            <Text style={styles.recordSecondaryValue}>
              {records.longestStreak} {records.longestStreak === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>GOAL DAYS</Text>
            <Text style={styles.recordSecondaryValue}>{records.goalDays}</Text>
          </View>
        </View>

        <Text style={styles.smallMuted}>
          Based on {records.recordedDays} recorded days · available history only
        </Text>
      </View>

      {[
        [Activity, 'Activity history', 'Your steps and personal records', 'YOUR ACTIVITY'],
        [Trophy, 'Achievements', 'Your milestones and streaks', null],
        [Heart, 'Health preferences', 'Your goals and permissions', 'PREFERENCES'],
        [Moon, 'Appearance', 'Light and dark mode', null],
        [Settings, 'Settings', 'Privacy, account and support', 'APP'],
      ].map(([Icon, title, subtitle, group]: any) => (
        <View key={title}>
          {group && (
            <Text style={styles.profileGroupLabel}>{group}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${title === 'Appearance' ? `Current setting: ${appearance}. Change appearance` : subtitle}`}
            onPress={
              title === 'Appearance' ? onAppearancePress
                : title === 'Activity history' ? onActivityHistoryPress
                  : title === 'Achievements' ? onAchievementsPress
                    : title === 'Health preferences' ? onHealthPreferencesPress
                      : onSettingsPress
            }
            style={({ pressed }) => [
              styles.settingRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.settingIcon}>
              <Icon size={19} color={INK} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{title}</Text>
              <Text style={styles.smallMuted}>
                {title === 'Appearance'
                  ? `${appearance === 'system' ? 'System default' : appearance === 'dark' ? 'Dark mode' : 'Light mode'} · Tap to change`
                  : subtitle}
              </Text>
            </View>
            <ArrowRight size={17} color={MUTED} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const INTRO_WORDMARK_LETTERS = [
  require('./assets/wordmark/light-01-s.png'),
  require('./assets/wordmark/light-02-t.png'),
  require('./assets/wordmark/light-03-e.png'),
  require('./assets/wordmark/light-04-p.png'),
  require('./assets/wordmark/light-05-a.png'),
  require('./assets/wordmark/light-06-r.png'),
  require('./assets/wordmark/light-07-e.png'),
  require('./assets/wordmark/light-08-n.png'),
  require('./assets/wordmark/light-09-a.png'),
] as const;

const INTRO_WORDMARK_LETTERS_DARK = [
  require('./assets/wordmark/dark-01-s.png'),
  require('./assets/wordmark/dark-02-t.png'),
  require('./assets/wordmark/dark-03-e.png'),
  require('./assets/wordmark/dark-04-p.png'),
  require('./assets/wordmark/dark-05-a.png'),
  require('./assets/wordmark/dark-06-r.png'),
  require('./assets/wordmark/dark-07-e.png'),
  require('./assets/wordmark/dark-08-n.png'),
  require('./assets/wordmark/dark-09-a.png'),
] as const;

export default function App() {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const isDark = themePreference === 'system'
    ? systemColorScheme === 'dark'
    : themePreference === 'dark';

  // Rebuild the existing style sheet with semantic colors; screen layout stays unchanged.
  INK = isDark ? '#F2F0F2' : '#202024';
  PAPER = isDark ? '#141416' : '#F5F4F1';
  WHITE = '#FBFAFB';
  MUTED = isDark ? '#AAA7AE' : '#77746F';
  LINE = isDark ? '#343237' : '#E3E1DC';
  SURFACE = isDark ? '#202024' : '#FFFFFF';
  DARK_SURFACE = '#202024';
  CHALLENGE_ACTION_SURFACE = isDark ? '#38363D' : '#202024';
  SOFT_SURFACE = isDark ? '#2B292E' : '#EEECE7';
  TRACK = isDark ? '#343237' : '#ECEAE6';
  AVATAR_SURFACE = isDark ? '#343237' : '#E9E6E0';
  ACCENT_SOFT = isDark ? '#3A2423' : '#FFF0EC';
  SEGMENT_SURFACE = isDark ? '#29272C' : '#ECEAE6';
  PROGRESS_TRACK = isDark ? '#343237' : '#E8E6E1';
  RING_EMPTY = isDark ? '#46434A' : '#D9D6D0';
  styles = createStyles();

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('steparena.themePreference')
      .then((value) => {
        if (!active) return;
        if (value === 'system' || value === 'light' || value === 'dark') {
          setThemePreference(value);
        }
      })
      .catch((error) => console.warn('Could not load appearance preference:', error));
    return () => { active = false; };
  }, []);

  const updateThemePreference = (preference: ThemePreference) => {
    setThemePreference(preference);
    AsyncStorage.setItem('steparena.themePreference', preference).catch((error) => {
      console.warn('Could not save appearance preference:', error);
      showMessage('Appearance not saved', 'Your theme changed for this session, but the preference could not be saved.');
    });
  };

  const openAppearancePicker = () => {
    Alert.alert(
      'Appearance',
      'Choose how StepArena should look.',
      [
        { text: `System${themePreference === 'system' ? ' ✓' : ''}`, onPress: () => updateThemePreference('system') },
        { text: `Light${themePreference === 'light' ? ' ✓' : ''}`, onPress: () => updateThemePreference('light') },
        { text: `Dark${themePreference === 'dark' ? ' ✓' : ''}`, onPress: () => updateThemePreference('dark') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [dailySteps, setDailySteps] = useState(0);
  const dailyStepsRef = useRef(0);
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_DAILY_GOAL);
  const dailyGoalRef = useRef(DEFAULT_DAILY_GOAL);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activityHistory, setActivityHistory] = useState<DailyActivity[]>([]);
  const activityHistoryRef = useRef<DailyActivity[]>([]);
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([]);
  const [badgesLoaded, setBadgesLoaded] = useState(false);
  const [celebrationAchievement, setCelebrationAchievement] =
    useState<(typeof ACHIEVEMENTS)[number] | null>(null);
  const celebrationScale = useRef(new Animated.Value(0.85)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const [showIntro, setShowIntro] = useState(true);
  const introOpacity = useRef(new Animated.Value(1)).current;
  const introRunnerOpacity = useRef(new Animated.Value(0)).current;
  const introRunnerScale = useRef(new Animated.Value(0.90)).current;
  const introWordmarkOpacity = useRef(new Animated.Value(0)).current;

  const seenUnlocks = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!showIntro) return;

    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(introRunnerOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(introRunnerScale, {
          toValue: 1,
          damping: 16,
          stiffness: 180,
          mass: 0.7,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(introWordmarkOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(80),
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]);

    intro.start(({ finished }) => {
      if (finished) setShowIntro(false);
    });

    return () => intro.stop();
  }, [
    showIntro,
    introOpacity,
    introRunnerOpacity,
    introRunnerScale,
    introWordmarkOpacity,
  ]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('steparena.dailyGoal')
      .then((raw) => {
        if (!active || raw === null) return;
        const savedGoal = Number(raw);
        if (isValidDailyGoal(savedGoal)) { dailyGoalRef.current = savedGoal; setDailyGoal(savedGoal); }
      })
      .catch((error) => console.warn('Could not load daily goal:', error))
      .finally(() => { if (active) setGoalLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const refreshDate = () => setCurrentDate(new Date());
    const interval = setInterval(refreshDate, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDate();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  const updateDailyGoal = (nextGoal: number) => {
    if (!isValidDailyGoal(nextGoal)) return;
    dailyGoalRef.current = nextGoal;
    setDailyGoal(nextGoal);
    AsyncStorage.setItem('steparena.dailyGoal', String(nextGoal)).catch((error) => {
      console.warn('Could not save daily goal:', error);
      showMessage('Goal not saved', 'The target changed for this session, but could not be saved on this device.');
    });
  };

  const dateLabel = currentDate.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();

  const getTodayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    let active = true;

    const today = getTodayKey();
    let loadSucceeded = false;

    AsyncStorage.getItem('steparena.dailyActivity')
      .then((raw) => {
        if (!active) return;

        try {
          const saved = raw ? JSON.parse(raw) : {};
          const loadedHistory: DailyActivity[] = Array.isArray(saved.history)
            ? saved.history
                .filter(
                  (entry: any) =>
                    typeof entry?.date === 'string' &&
                    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
                    Number.isInteger(entry.steps) &&
                    entry.steps >= 0
                )
                .map((entry: any) => ({
                  date: entry.date,
                  steps: entry.steps,
                  goal: isValidDailyGoal(Number(entry.goal))
                    ? Number(entry.goal)
                    : DEFAULT_DAILY_GOAL,
                }))
            : [];

          const archivedHistory = [...loadedHistory];

          // One-time recovery of the user's confirmed October 28 total.
          // Replace an incorrect entry for that date, without duplicating it.
          const recoveredDay = { date: '2026-10-28', steps: 23125, goal: DEFAULT_DAILY_GOAL };
          const recoveredIndex = archivedHistory.findIndex(
            (entry) => entry.date === recoveredDay.date
          );
          if (recoveredIndex >= 0) {
            archivedHistory[recoveredIndex] = recoveredDay;
          } else {
            archivedHistory.push(recoveredDay);
          }






          // Archive the previous saved day before starting a fresh day.
          if (
            typeof saved.date === 'string' &&
            saved.date !== today &&
            /^\d{4}-\d{2}-\d{2}$/.test(saved.date) &&
            Number.isInteger(saved.steps) &&
            saved.steps >= 0 &&
            saved.date < today
          ) {
            const existingIndex = archivedHistory.findIndex(
              (entry) => entry.date === saved.date
            );
            const savedGoalForDay = archivedHistory.find((entry) => entry.date === saved.date)?.goal;
            const previousDay = {
              date: saved.date,
              steps: saved.steps,
              goal: isValidDailyGoal(Number(savedGoalForDay)) ? Number(savedGoalForDay) : DEFAULT_DAILY_GOAL,
            };

            if (existingIndex >= 0) archivedHistory[existingIndex] = previousDay;
            else archivedHistory.push(previousDay);
          }

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 364);
          const cutoffKey = localDateKey(cutoff);

          const retainedHistory = archivedHistory
            .filter((entry) => entry.date >= cutoffKey && entry.date <= today)
            .sort((a, b) => a.date.localeCompare(b.date));

          activityHistoryRef.current = retainedHistory;
          setActivityHistory(retainedHistory);

          if (
            saved.date === today &&
            Number.isInteger(saved.steps) &&
            saved.steps >= 0
          ) {
            dailyStepsRef.current = saved.steps;
            setDailySteps(saved.steps);
          } else {
            dailyStepsRef.current = 0;
            setDailySteps(0);
          }

          loadSucceeded = true;
        } catch (error) {
          console.warn('Saved daily activity is invalid; saving is paused to protect existing data.', error);
        }
      })
      .catch((error) => {
        console.warn('Could not load daily activity:', error);
      })
      .finally(() => {
        if (active && loadSucceeded) setStepsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!stepsLoaded || !goalLoaded) return;

    const today = getTodayKey();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 364);
    const cutoffKey = localDateKey(cutoff);

    const nextHistory = [
      ...activityHistory.filter((entry) => entry.date !== today),
      { date: today, steps: dailySteps, goal: dailyGoal },
    ]
      .filter((entry) => entry.date >= cutoffKey && entry.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    activityHistoryRef.current = nextHistory;
    dailyStepsRef.current = dailySteps;

    AsyncStorage.setItem(
      'steparena.dailyActivity',
      JSON.stringify({
        date: today,
        steps: dailySteps,
        goal: dailyGoal,
        history: nextHistory,
      })
    ).catch((error) => {
      console.warn('Could not save daily activity:', error);
    });
  }, [dailySteps, dailyGoal, activityHistory, stepsLoaded, goalLoaded]);

  const weekData = buildActivityWeek(activityHistory, dailySteps, dailyGoal, currentDate);
  const streakDays = calculateStreak(activityHistory, dailySteps, dailyGoal);
  const goalDays = countGoalDays(activityHistory, dailySteps, dailyGoal);
  const personalRecords = calculatePersonalRecords(activityHistory, dailySteps, dailyGoal);
  const currentlyUnlocked = getUnlockedAchievementIds(dailySteps, streakDays, goalDays);

  useEffect(() => {
    if (!badgesLoaded) return;

    // Establish the initial baseline without celebrating old achievements.
    if (seenUnlocks.current === null) {
      seenUnlocks.current = new Set([...earnedBadgeIds, ...currentlyUnlocked]);
      return;
    }

    const newlyUnlocked = currentlyUnlocked.filter(
      (id) => !seenUnlocks.current?.has(id)
    );

    currentlyUnlocked.forEach((id) => seenUnlocks.current?.add(id));

    if (newlyUnlocked.length > 0) {
      const achievement = ACHIEVEMENTS.find(
        (item) => item.id === newlyUnlocked[0]
      );

      if (achievement) {
        setCelebrationAchievement(achievement);
      }
    }
  }, [badgesLoaded, currentlyUnlocked.join(',')]);

  useEffect(() => {
    if (!celebrationAchievement) return;

    celebrationScale.setValue(0.82);
    celebrationOpacity.setValue(0);

    const entrance = Animated.parallel([
      Animated.spring(celebrationScale, {
        toValue: 1,
        damping: 15,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(celebrationOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);

    entrance.start();

    return () => entrance.stop();
  }, [celebrationAchievement, celebrationScale, celebrationOpacity]);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem('steparena.earnedAchievements')
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved)) {
            setEarnedBadgeIds(
              saved.filter(
                (id): id is string =>
                  typeof id === 'string' &&
                  ACHIEVEMENTS.some((achievement) => achievement.id === id)
              )
            );
          }
        } catch {
          console.warn('Saved achievements were invalid; starting fresh.');
        }
      })
      .catch((error) => {
        console.warn('Could not load achievements:', error);
      })
      .finally(() => {
        if (active) setBadgesLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!badgesLoaded) return;

    const merged = [...new Set([...earnedBadgeIds, ...currentlyUnlocked])];
    if (
      merged.length !== earnedBadgeIds.length ||
      merged.some((id) => !earnedBadgeIds.includes(id))
    ) {
      setEarnedBadgeIds(merged);
    }

    AsyncStorage.setItem(
      'steparena.earnedAchievements',
      JSON.stringify(merged)
    ).catch((error) => {
      console.warn('Could not save achievements:', error);
    });
  }, [badgesLoaded, currentlyUnlocked.join(','), earnedBadgeIds.join(',')]);

  const applyNativeStepDelta = (amount: number) => {
    if (!stepsLoaded || !Number.isInteger(amount) || amount <= 0) return;

    const nextSteps = Math.min(dailyStepsRef.current + amount, 1000000);
    dailyStepsRef.current = nextSteps;
    setDailySteps(nextSteps);

    const today = getTodayKey();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 364);
    const cutoffKey = localDateKey(cutoff);

    const nextHistory = [
      ...activityHistoryRef.current.filter((entry) => entry.date !== today),
      { date: today, steps: nextSteps, goal: dailyGoalRef.current },
    ]
      .filter((entry) => entry.date >= cutoffKey && entry.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    activityHistoryRef.current = nextHistory;
    setActivityHistory(nextHistory);

    AsyncStorage.setItem(
      'steparena.dailyActivity',
      JSON.stringify({ date: today, steps: nextSteps, goal: dailyGoalRef.current, history: nextHistory })
    ).catch((error) => {
      console.warn('Could not immediately save added steps:', error);
    });
  };


  const nativeSyncInProgress = useRef(false);

  // Native Android service records steps while JavaScript is suspended.
  // On resume, only the difference since the last sync is added to history.
  useEffect(() => {
    if (!stepsLoaded || Platform.OS !== 'android') return;

    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let appStateSubscription: { remove: () => void } | null = null;

    const nativeSteps = NativeModules.StepCounter as
      | {
          startTracking: () => Promise<boolean>;
          getDailySteps: () => Promise<number>;
          getDiagnostics: () => Promise<{
            today: string;
            storedDate: string | null;
            nativeDailySteps: number;
            lastRaw: number;
            trackingEnabled: boolean;
          }>;
        }
      | undefined;

    const syncNativeSteps = async () => {
      if (!active || !nativeSteps || nativeSyncInProgress.current) return;

      nativeSyncInProgress.current = true;
      try {
        const total = await nativeSteps.getDailySteps();
        if (!active || !Number.isFinite(total) || total < 0) return;

        const nativeDiagnostics = await nativeSteps.getDiagnostics();
        const syncRaw = await AsyncStorage.getItem('steparena.nativeStepSync');
        const activityRaw = await AsyncStorage.getItem('steparena.dailyActivity');

        let syncData = null;
        let activityData = null;

        try { syncData = syncRaw ? JSON.parse(syncRaw) : null; } catch {}
        try { activityData = activityRaw ? JSON.parse(activityRaw) : null; } catch {}

        console.log('[STEP_DIAGNOSTICS]', JSON.stringify({
          native: nativeDiagnostics,
          nativeGetterTotal: total,
          jsSyncBaseline: syncData,
          jsDailyActivity: activityData
            ? {
                date: activityData.date,
                steps: activityData.steps,
                todayHistory: activityData.history?.[getTodayKey()] ?? null,
              }
            : null,
        }));


        const today = getTodayKey();
        const syncKey = 'steparena.nativeStepSync';
        const raw = await AsyncStorage.getItem(syncKey);
        if (!active) return;

        let previous: { date?: string; total?: number } | null = null;
        if (raw) {
          try {
            previous = JSON.parse(raw);
          } catch {
            previous = null;
          }
        }

        // Native getDailySteps returns zero when its stored date is stale.
        // On a new day, import that day's native total instead of losing it
        // by recording it only as a baseline.
        if (previous?.date !== today) {
          if (total > 0) applyNativeStepDelta(total);
        } else if (
          typeof previous.total === 'number' &&
          Number.isInteger(previous.total) &&
          total >= previous.total
        ) {
          const difference = total - previous.total;
          if (difference > 0) applyNativeStepDelta(difference);
        }

        // Avoid redundant AsyncStorage writes when the native total is unchanged.
        if (previous?.date !== today || previous.total !== total) {
          await AsyncStorage.setItem(
            syncKey,
            JSON.stringify({ date: today, total })
          );
        }
      } catch (error) {
        console.warn('[StepArena native sensor] Sync failed:', error);
      } finally {
        nativeSyncInProgress.current = false;
      }
    };

    const start = async () => {
      try {
        if (!nativeSteps) {
          console.warn('[StepArena native sensor] Native module unavailable. Rebuild the Android app.');
          return;
        }

        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
        );
        if (!active) return;

        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[StepArena native sensor] Activity Recognition permission not granted.');
          return;
        }

        await nativeSteps.startTracking();
        if (!active) return;

        // The native service tracks steps independently of JavaScript.
        // Poll only while the app is foregrounded to avoid background wake-ups.
        await syncNativeSteps();

        const startForegroundPolling = () => {
          if (interval) return;
          interval = setInterval(() => void syncNativeSteps(), 10000);
        };

        const stopForegroundPolling = () => {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        };

        appStateSubscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void syncNativeSteps();
            startForegroundPolling();
          } else {
            stopForegroundPolling();
          }
        });

        if (AppState.currentState === 'active') {
          startForegroundPolling();
        }

        console.log('[StepArena native sensor] Background tracking service started.');
      } catch (error) {
        console.warn('[StepArena native sensor] Startup failed:', error);
      }
    };

    void start();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      appStateSubscription?.remove();
    };
  }, [stepsLoaded]);


  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const previousTabIndex = useRef(0);
  const navIndicatorScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    navIndicatorScale.setValue(0.55);
    const animation = Animated.spring(navIndicatorScale, {
      toValue: 1,
      damping: 15,
      stiffness: 240,
      mass: 0.7,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [activeTab, navIndicatorScale]);

  const navigate = (tab: Tab) => {
    if (tab === activeTab || busy.current) return;
    busy.current = true;

    const tabOrder: Tab[] = ['Home', 'Compete', 'Challenges', 'Profile'];
    const nextIndex = tabOrder.indexOf(tab);
    const direction = nextIndex >= previousTabIndex.current ? 1 : -1;

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: -direction * 12,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        busy.current = false;
        return;
      }

      previousTabIndex.current = nextIndex;
      setActiveTab(tab);
      slide.setValue(direction * 12);

      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(() => {
        busy.current = false;
      });
    });
  };

  const introWordmarkLetters = isDark
    ? INTRO_WORDMARK_LETTERS_DARK
    : INTRO_WORDMARK_LETTERS;

  const openActivityHistory = () => {
    const sortedHistory = [...activityHistory]
      .filter((entry) => entry.date !== getTodayKey())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
    const todayLine = `${getTodayKey()}: ${dailySteps.toLocaleString('en-US')} steps (today)`;
    const historyLines = sortedHistory.length
      ? sortedHistory.map((entry) => `${entry.date}: ${entry.steps.toLocaleString('en-US')} steps`).join('\\n')
      : 'No previous recorded days yet.';
    showMessage('Activity history', `${todayLine}\n\nRecent days\n${historyLines}\n\nTotal recorded steps: ${personalRecords.totalSteps.toLocaleString('en-US')}\nBest day: ${personalRecords.bestDay.toLocaleString('en-US')} steps`);
  };

  const openHealthPreferences = () => {
    const sensorAvailable = Platform.OS === 'android' && Boolean(NativeModules.StepCounter);
    showMessage(
      'Health preferences',
      `Step tracking: ${sensorAvailable ? 'Android step-counter module is available.' : 'Automatic step tracking is not available in this app build.'}\n\nYour activity history is stored locally on this device. Health permissions can be managed in Android Settings → Apps → StepArena → Permissions.\n\nYour daily step goal is saved locally. Changes apply from today onward; past daily targets remain unchanged.`
    );
  };

  const openSettings = () => {
    Alert.alert('Settings', 'StepArena settings', [
      {
        text: 'Privacy',
        onPress: () => showMessage('Privacy', 'Your step history, daily goal and achievements are stored locally on this device. Online rankings and friend features are not currently available.'),
      },
      {
        text: 'Support',
        onPress: () => showMessage('Support', 'For now, you can review app status and local data here. No support account or online support service is connected.'),
      },
      { text: 'Close', style: 'cancel' },
    ]);
  };

  const openAchievements = () => {
    setActiveTab('Challenges');
  };

  const screens: Record<Tab, React.ReactNode> = {
    Home: (
      <HomeScreen
        introComplete={!showIntro}
        steps={dailySteps}
        weekData={weekData}
        activityHistory={activityHistory}
        streakDays={streakDays}
        goal={dailyGoal}
        onGoalChange={updateDailyGoal}
        dateLabel={dateLabel}
      />
    ),
    Compete: <CompeteScreen />,
    Challenges: (
      <ChallengesScreen
        steps={dailySteps}
        streakDays={streakDays}
        goalDays={goalDays}
        earnedBadgeIds={earnedBadgeIds}
        dailyGoal={dailyGoal}
      />
    ),
    Profile: (
      <ProfileScreen
        earnedBadgeIds={earnedBadgeIds}
        records={personalRecords}
        appearance={themePreference}
        onAppearancePress={openAppearancePicker}
        onActivityHistoryPress={openActivityHistory}
        onAchievementsPress={openAchievements}
        onHealthPreferencesPress={openHealthPreferences}
        onSettingsPress={openSettings}
      />
    ),
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.app}>
        <Animated.View
          style={[
            styles.screen,
            { opacity: fade, transform: [{ translateY: slide }] },
          ]}
        >
          {screens[activeTab]}
        </Animated.View>

        {showIntro && (
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel="StepArena"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100,
              elevation: 100,
              backgroundColor: PAPER,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: introOpacity,
            }}
          >
            <Animated.Image
              source={
                isDark
                  ? require('./assets/splash-runner-dark.png')
                  : require('./assets/splash-runner-light.png')
              }
              resizeMode="contain"
              style={{
                width: 230,
                height: 230,
                opacity: introRunnerOpacity,
                transform: [{ scale: introRunnerScale }],
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                opacity: 1,
              }}
            >
              {introWordmarkLetters.map((source, index) => (
                <Animated.Image
                  key={`wordmark-${index}`}
                  source={source}
                  resizeMode="contain"
                  style={{
                    width: 32,
                    height: 32,
                    marginHorizontal: 1,
                    opacity: introWordmarkOpacity,
                  }}
                />
              ))}
            </View>

            <View
              style={{
                width: 38,
                height: 3,
                borderRadius: 2,
                backgroundColor: ORANGE,
                marginTop: 12,
              }}
            />
          </Animated.View>
        )}

        {celebrationAchievement && (
          <View
            accessibilityViewIsModal
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              backgroundColor: 'rgba(32,32,36,0.48)',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Animated.View
              style={{
                width: '100%',
                maxWidth: 340,
                backgroundColor: PAPER,
                borderRadius: 22,
                padding: 26,
                alignItems: 'center',
                opacity: celebrationOpacity,
                transform: [{ scale: celebrationScale }],
              }}
            >
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: ACCENT_SOFT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: isDark ? '#70413A' : '#FFD2C9',
                }}
              >
                <Trophy size={34} color={ORANGE} strokeWidth={1.8} />
              </View>

              <Text
                style={{
                  color: ORANGE,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 2.2,
                  marginBottom: 9,
                }}
              >
                ACHIEVEMENT UNLOCKED
              </Text>

              <Text
                style={{
                  color: INK,
                  fontSize: 25,
                  fontWeight: '500',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                {celebrationAchievement.title}
              </Text>

              <Text
                style={{
                  color: MUTED,
                  fontSize: 13,
                  lineHeight: 20,
                  textAlign: 'center',
                  marginBottom: 23,
                }}
              >
                {celebrationAchievement.description}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => setCelebrationAchievement(null)}
                style={({ pressed }) => ({
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 13,
                  backgroundColor: ORANGE,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Text style={{ color: WHITE, fontSize: 13, fontWeight: '700' }}>
                  Keep it up
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        )}

        <View style={styles.bottomNav}>
          {tabs.map(({ name, icon: Icon }) => {
            const selected = activeTab === name;
            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => navigate(name)}
                style={styles.navItem}
              >
                <View style={styles.navIconWrap}>
                  <Icon
                    size={21}
                    color={selected ? INK : MUTED}
                    strokeWidth={selected ? 2.5 : 1.6}
                  />
                  {selected && (
                    <Animated.View
                      style={[
                        styles.navDot,
                        { transform: [{ scale: navIndicatorScale }] },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.navLabel,
                    selected && styles.navLabelActive,
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles() {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER, paddingTop: StatusBar.currentHeight ?? 0 },
  app: { flex: 1, backgroundColor: PAPER },
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 23, paddingTop: 18, paddingBottom: 32 },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.1,
    color: MUTED,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 27,
  },
  date: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: MUTED,
    marginTop: 6,
  },
  roundButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  hero: { paddingTop: 10, paddingBottom: 17 },
  stepLabelRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bigSteps: {
    fontSize: 57,
    lineHeight: 70,
    fontWeight: '300',
    letterSpacing: -2.5,
    color: INK,
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },
  goalCaption: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 1,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 27,
    gap: 15,
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    fontSize: 27,
    fontWeight: '300',
    color: INK,
    letterSpacing: -1,
  },
  smallMuted: { color: MUTED, fontSize: 11, lineHeight: 17 },
  progressCopy: { flex: 1, gap: 5 },
  remaining: {
    color: INK,
    fontSize: 30,
    fontWeight: '300',
    letterSpacing: -1,
    marginTop: 7,
  },
  thinLine: { height: 1, backgroundColor: LINE, marginVertical: 10 },
  progressNote: { fontSize: 11, color: INK },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 23, color: INK, fontWeight: '300' },
  metricDivider: { height: 28, width: 1, backgroundColor: LINE },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 29,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, color: INK, fontWeight: '500' },
  weekNavigator: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  weekArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  weekRange: { color: MUTED, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  weekCard: {
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 12,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  weekPointsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 4, height: 103 },
  weekColumnAnimated: { flex: 1, minWidth: 0 },
  weekColumn: { flex: 1, alignItems: 'stretch', borderRadius: 11, overflow: 'visible', paddingHorizontal: 4, paddingTop: 7, paddingBottom: 6, backgroundColor: 'transparent' },
  weekDetailSlot: { borderTopColor: LINE, justifyContent: 'center', overflow: 'hidden' },
  weekDetailContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 5 },
  weekDetailHeading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  weekDetailStats: { width: '40%', justifyContent: 'center' },
  weekDetailHourly: { flex: 1, minWidth: 0, alignItems: 'stretch', justifyContent: 'center' },
  weekDetailPlaceholder: { color: MUTED, fontSize: 10, letterSpacing: 0.3, textAlign: 'center' },
  weekColumnPressed: { opacity: 0.82 },
  weekColumnTop: { alignItems: 'center', gap: 7 },
  weekColumnTopExpanded: { alignItems: 'center', gap: 7 },
  barTrack: { height: 58, width: 13, backgroundColor: TRACK, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  barTrackExpanded: { height: 58, width: 13 },
  expandedDayContent: { marginTop: 9, gap: 1, overflow: 'hidden' },
  expandedDayDate: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  expandedDaySteps: { color: INK, fontSize: 25, fontWeight: '500', fontVariant: ['tabular-nums'], marginTop: 4 },
  expandedDayCaption: { color: MUTED, fontSize: 9, letterSpacing: 0.65, fontWeight: '700' },
  expandedDayGoalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 3 },
  expandedDayGoal: { color: ORANGE, fontSize: 12, fontWeight: '700' },
  expandedDayHint: { color: MUTED, fontSize: 10, letterSpacing: 0.2, marginTop: 5 },
  miniHourlyBars: { height: 44, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 8 },
  miniHourlyTrack: { flex: 1, height: '100%', justifyContent: 'flex-end', backgroundColor: TRACK, borderRadius: 2, overflow: 'hidden' },
  miniHourlyBar: { width: '100%', borderRadius: 2 },
  dayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  dayDotAnchor: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  dayDotToday: { backgroundColor: ORANGE },
  dayDotSelected: { width: 7, height: 7, backgroundColor: ORANGE },
  weekStepsTiny: { color: MUTED, fontSize: 8, fontVariant: ['tabular-nums'] },
  anchorDay: { fontWeight: '800', color: INK },
  inlineDayDetail: { marginTop: 12, paddingTop: 12, gap: 11 },
  detailTopLine: { height: 1, backgroundColor: LINE, marginBottom: 1 },
  dayDetailEyebrow: { color: MUTED, fontSize: 9, letterSpacing: 1.7, fontWeight: '700' },
  dayDetailDate: { color: INK, fontSize: 17, fontWeight: '500' },
  detailClose: { paddingHorizontal: 9, paddingVertical: 7 },
  dayDetailStats: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  dayDetailSteps: { color: INK, fontSize: 29, fontWeight: '300', fontVariant: ['tabular-nums'] },
  dayDetailGoal: { color: ORANGE, fontSize: 22, fontWeight: '500' },
  hourlySection: { marginTop: 3, paddingTop: 15, borderTopWidth: 1, borderTopColor: LINE, gap: 14 },
  hourlyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 },
  hourlyTitle: { color: INK, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  hourlyUnit: { color: MUTED, fontSize: 8, letterSpacing: 1 },
  hourlyChartScroll: { paddingTop: 8, paddingBottom: 5, paddingHorizontal: 2 },
  hourlyDotChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  hourColumn: { width: 14, alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingVertical: 6, borderRadius: 8 },
  hourColumnSelected: { backgroundColor: SOFT_SURFACE },
  hourDotStack: { height: 86, justifyContent: 'flex-end', gap: 2.5 },
  hourDot: { width: 5, height: 5, borderRadius: 1.5, backgroundColor: TRACK },
  hourDotActive: { backgroundColor: MUTED },
  hourDotSelected: { backgroundColor: ORANGE, transform: [{ scale: 1.08 }] },
  hourTick: { height: 11, color: MUTED, fontSize: 7, fontVariant: ['tabular-nums'] },
  hourTickSelected: { color: ORANGE, fontWeight: '800' },
  hourAxisLine: { height: 1, backgroundColor: LINE, marginTop: 2 },
  hourSelectedReadout: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 5 },
  hourReadoutLabel: { color: MUTED, fontSize: 8, letterSpacing: 1.3, fontWeight: '700' },
  hourReadoutTime: { color: INK, fontSize: 15, fontWeight: '500', marginTop: 3 },
  hourReadoutValueWrap: { alignItems: 'flex-end' },
  hourReadoutValue: { color: INK, fontSize: 22, fontWeight: '300', fontVariant: ['tabular-nums'] },
  hourlyFootnote: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  hourlyFootnoteText: { color: MUTED, fontSize: 8, letterSpacing: 0.25 },
  hourlyEmpty: { paddingVertical: 12, gap: 5 },
  hourlyEmptyTitle: { color: INK, fontSize: 13, fontWeight: '500' },
  hourlyMessage: { color: MUTED, fontSize: 10, lineHeight: 16 },
  dayDetailStatus: { color: ORANGE, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  weekSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 },
  weekSummaryValue: { color: INK, fontSize: 17, fontWeight: '500', fontVariant: ['tabular-nums'] },
  bar: { width: '100%', borderRadius: 9 },
  weekDay: { fontSize: 10, color: MUTED },
  darkFeature: {
    marginTop: 17,
    backgroundColor: DARK_SURFACE,
    borderRadius: 17,
    padding: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  featureText: { flex: 1, gap: 7 },
  featureTitle: { fontSize: 22, color: WHITE, fontWeight: '400' },
  featureSubtitle: { fontSize: 11, color: '#C1BFC3' },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#343337',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakNumber: { color: INK, fontSize: 22, marginBottom: 5 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: INK },
  dotActive: { backgroundColor: ORANGE, width: 10, height: 10, borderRadius: 5 },
  dotEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderColor: LINE },
  pageTitle: {
    fontSize: 38,
    lineHeight: 46,
    color: INK,
    fontWeight: '300',
    letterSpacing: -1.5,
    marginTop: 12,
  },
  pageSubtitle: { fontSize: 12, color: MUTED, marginTop: 4, marginBottom: 24 },
  segment: {
    backgroundColor: SEGMENT_SURFACE,
    borderRadius: 25,
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  segmentOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 9 },
  segmentActive: {
    backgroundColor: DARK_SURFACE,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 19,
  },
  segmentActiveText: { color: WHITE, fontSize: 10, letterSpacing: 1.4 },
  segmentText: {
    color: MUTED,
    fontSize: 10,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  rankCard: { backgroundColor: SURFACE, borderRadius: 17, padding: 18 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  rankBig: { color: INK, fontSize: 42, fontWeight: '300', letterSpacing: -2 },
  rankName: { color: INK, fontSize: 14, marginBottom: 5 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: LINE,
  },
  youRow: {
    backgroundColor: SOFT_SURFACE,
    borderRadius: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
  },
  rankIndex: { width: 23, color: MUTED, fontSize: 11 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AVATAR_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 13, fontWeight: '600', color: INK },
  personName: { fontSize: 13, color: INK, fontWeight: '500' },
  personHandle: { fontSize: 10, color: MUTED, marginTop: 3 },
  personScore: { color: INK, fontSize: 12, fontVariant: ['tabular-nums'] },
  primaryButton: {
    backgroundColor: DARK_SURFACE,
    borderRadius: 28,
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 23,
  },
  primaryButtonText: { color: WHITE, fontSize: 13, fontWeight: '500' },
  goalModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    padding: 22,
  },
  goalModalCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: LINE,
    gap: 13,
  },
  goalModalTitle: { color: INK, fontSize: 27, fontWeight: '300', letterSpacing: -0.8 },
  goalPresetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  goalPreset: {
    minWidth: '21%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    backgroundColor: PAPER,
  },
  goalPresetSelected: { backgroundColor: ACCENT_SOFT, borderColor: ORANGE },
  goalPresetText: { color: INK, fontSize: 12, fontWeight: '600' },
  goalPresetTextSelected: { color: INK },
  goalInput: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: INK,
    backgroundColor: PAPER,
    fontSize: 15,
  },
  goalModalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 },
  goalCancelButton: { paddingHorizontal: 15, paddingVertical: 12 },
  goalCancelText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  goalSaveButton: { backgroundColor: DARK_SURFACE, borderRadius: 22, paddingHorizontal: 19, paddingVertical: 12 },
  goalSaveText: { color: WHITE, fontSize: 12, fontWeight: '600' },
  challengeCard: {
    marginTop: 5,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 20,
  },
  challengeTitle: {
    fontSize: 30,
    fontWeight: '300',
    color: INK,
    letterSpacing: -1,
    marginTop: 15,
    marginBottom: 7,
  },
  challengeDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 6,
  },
  challengeProgress: { color: MUTED, fontSize: 9, letterSpacing: 1 },

  challengeProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: PROGRESS_TRACK,
    marginRight: 12,
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: ORANGE,
  },
  challengeJoinButton: {
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: CHALLENGE_ACTION_SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeLeaveButton: {
    backgroundColor: SOFT_SURFACE,
  },
  challengeJoinText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '500',
  },
  challengeLeaveText: {
    color: INK,
  },

  inlineBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkChallenge: {
    backgroundColor: DARK_SURFACE,
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
  },
  darkSubtitle: { color: '#C1BFC3', fontSize: 12, lineHeight: 19 },
  lightButton: {
    marginTop: 23,
    backgroundColor: '#FBFAFB',
    borderRadius: 28,
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightButtonText: { color: DARK_SURFACE, fontSize: 12, fontWeight: '500' },
  recordPrimaryValue: {
    color: INK,
    fontSize: 27,
    fontWeight: '400',
    letterSpacing: -0.8,
    marginTop: 7,
    fontVariant: ['tabular-nums'],
  },
  recordSecondaryValue: {
    color: INK,
    fontSize: 20,
    fontWeight: '400',
    letterSpacing: -0.4,
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
  },
  achievementCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: PAPER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementStatus: { color: MUTED, fontSize: 9, letterSpacing: 1 },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    paddingBottom: 22,
  },
  profileHeroCopy: {
    flex: 1,
    gap: 5,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AVATAR_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { fontSize: 21, color: INK, fontWeight: '400' },
  profileHandle: { color: MUTED, fontSize: 11, letterSpacing: 0.8 },
  profileAchievements: {
    marginBottom: 8,
  },
  profileAchievementsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingLeft: 8,
  },
  profileViewAllText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '600',
  },
  profileBadgeList: {
    flexDirection: 'row',
    gap: 9,
  },
  profileBadgeItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: SURFACE,
  },
  profileBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_SOFT,
  },
  profileBadgeTitle: {
    color: INK,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  profileEmptyAchievements: {
    padding: 15,
    borderRadius: 13,
    backgroundColor: SURFACE,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 19,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    marginBottom: 17,
  },
  profileGroupLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.7,
    marginTop: 23,
    marginBottom: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: LINE,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNav: {
    height: 69,
    backgroundColor: PAPER,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIconWrap: { alignItems: 'center', justifyContent: 'center', height: 25 },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ORANGE,
    position: 'absolute',
    bottom: -4,
  },
  navLabel: { fontSize: 9, color: MUTED },
  navLabelActive: { color: INK, fontWeight: '600' },
  });
}

let styles = createStyles();
