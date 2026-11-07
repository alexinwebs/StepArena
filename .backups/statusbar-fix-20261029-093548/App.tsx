import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
type DailyActivity = {
  date: string;
  steps: number;
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateStreak(history: DailyActivity[], todaySteps: number, threshold = 10000): number {
  const totals = new Map(history.map((entry) => [entry.date, entry.steps]));
  const today = new Date();
  const todayKey = localDateKey(today);
  totals.set(todayKey, todaySteps);

  // A streak may begin yesterday if today's goal has not yet been met.
  const start = new Date(today);
  if ((totals.get(todayKey) ?? 0) < threshold) {
    start.setDate(start.getDate() - 1);
  }

  let streak = 0;
  const cursor = new Date(start);

  while (true) {
    const key = localDateKey(cursor);
    if ((totals.get(key) ?? 0) < threshold) break;
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
  { id: 'streak-3', title: 'On a Roll', description: 'Complete 3 consecutive 10K days.', kind: 'streak', threshold: 3 },
  { id: 'streak-7', title: 'Week of Wins', description: 'Complete 7 consecutive 10K days.', kind: 'streak', threshold: 7 },
  { id: 'streak-30', title: 'Unstoppable', description: 'Complete 30 consecutive 10K days.', kind: 'streak', threshold: 30 },
  { id: 'goals-7', title: 'Consistency Counts', description: 'Complete the 10K goal on 7 days.', kind: 'goals', threshold: 7 },
] as const;

function countGoalDays(history: DailyActivity[], todaySteps: number): number {
  const today = localDateKey(new Date());
  const totals = new Map(history.map((entry) => [entry.date, entry.steps]));
  totals.set(today, todaySteps);
  return [...totals.values()].filter((steps) => steps >= 10000).length;
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

function calculatePersonalRecords(
  history: DailyActivity[],
  todaySteps: number,
) {
  const today = localDateKey(new Date());
  const totals = new Map<string, number>();

  history.forEach((entry) => {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
      Number.isInteger(entry.steps) &&
      entry.steps >= 0
    ) {
      totals.set(entry.date, entry.steps);
    }
  });

  // Today's live value replaces today's history entry.
  totals.set(today, todaySteps);

  const entries = [...totals.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const dailyTotals = entries.map(([, steps]) => steps);
  const goalDays = dailyTotals.filter((steps) => steps >= 10000).length;

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;

  for (const [dateKey, steps] of entries) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    const consecutive =
      previousDate !== null &&
      Math.round(
        (currentDate.getTime() - previousDate.getTime()) / 86400000
      ) === 1;

    if (steps >= 10000) {
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

function buildActivityWeek(history: DailyActivity[], todaySteps: number) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const byDate = new Map(history.map((item) => [item.date, item.steps]));
  byDate.set(todayKey, todaySteps);

  const monday = new Date(today);
  const weekday = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - weekday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = localDateKey(date);
    return {
      date: key,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      steps: byDate.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
}
import {
  Alert,
  Animated,
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
} from 'react-native';

import {
  Activity,
  ArrowRight,
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

const INK = '#202024';
const PAPER = '#F1EFF0';
const WHITE = '#FBFAFB';
const MUTED = '#929095';
const ORANGE = '#FF482F';
const LINE = '#DAD8DB';

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
}: {
  progress: number;
  size?: number;
}) {
  const safeProgress = Math.max(0, Math.min(progress, 1));
  const animatedProgress = useRef(new Animated.Value(safeProgress)).current;
  const [displayProgress, setDisplayProgress] = useState(safeProgress);

  useEffect(() => {
    const listenerId = animatedProgress.addListener(({ value }) => {
      setDisplayProgress(value);
    });

    Animated.timing(animatedProgress, {
      toValue: safeProgress,
      duration: 850,
      useNativeDriver: false,
    }).start();

    return () => {
      animatedProgress.removeListener(listenerId);
    };
  }, [animatedProgress, safeProgress]);

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
              backgroundColor: i < filledDots ? ORANGE : '#D9D7DA',
              opacity: i < filledDots ? 1 : 0.85,
            }}
          />
        );
      })}
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercent}>
          {Math.round(displayProgress * 100)}%
        </Text>
        <Text style={styles.smallMuted}>of 30,000</Text>
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
}: {
  value: number;
  style?: any;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: current }) => {
      setDisplayValue(Math.round(current));
    });

    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration: 1100,
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue, value]);

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
  onAddSteps,
  weekData,
  streakDays,
}: {
  steps: number;
  onAddSteps: (amount: number) => void;
  weekData: { date: string; day: string; steps: number; isToday: boolean }[];
  streakDays: number;
}) {
  const { width } = useWindowDimensions();
  const [goal, setGoal] = useState(30000);
  const [showGoal, setShowGoal] = useState(false);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.topBar}>
        <View>
          <Label>TODAY</Label>
          <Text style={styles.date}>MONDAY, 26 MAY</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adjust daily goal"
          onPress={() => {
            setGoal(goal === 30000 ? 10000 : 30000);
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
        <AnimatedNumber value={steps} style={styles.bigSteps} />
        <Text style={styles.goalCaption}>
          STEPS WALKED TODAY
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 6 }}>
          {[100, 500, 1000].map((amount) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityLabel={`Add ${amount} demo steps`}
              onPress={() => onAddSteps(amount)}
              style={({ pressed }) => [
                {
                  backgroundColor: WHITE,
                  borderWidth: 1,
                  borderColor: LINE,
                  borderRadius: 20,
                  paddingHorizontal: 15,
                  paddingVertical: 9,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '600' }}>
                +{amount.toLocaleString('en-US')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.progressSection}>
          <ProgressRing progress={Math.min(steps / goal, 1)} size={width * 0.42} />
          <View style={styles.progressCopy}>
            <Label>YOUR DAILY GOAL</Label>
            <Text style={styles.remaining}>
              {Math.max(goal - steps, 0).toLocaleString('en-US')}
            </Text>
            <Text style={styles.smallMuted}>steps remaining</Text>
            <View style={styles.thinLine} />
            <Text style={styles.progressNote}>
              {showGoal ? 'Goal updated' : 'Keep your momentum.'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric value={String(Math.round(steps / 100))} label="MINUTES*" />
        <View style={styles.metricDivider} />
        <Metric value={String(Math.round(steps * 0.021))} label="KCAL*" />
        <View style={styles.metricDivider} />
        <Metric value={(steps * 0.0007).toFixed(1)} label="KM*" />
      </View>
      <Text style={[styles.smallMuted, { marginTop: -10, marginBottom: 18 }]}>
        *Estimates based on demo steps
      </Text>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Your week</Text>
        <Text style={styles.smallMuted}>7 DAYS</Text>
      </View>

      <View style={styles.weekCard}>
        {weekData.map((item) => {
          const maxSteps = Math.max(10000, ...weekData.map((entry) => entry.steps));
          const height = item.steps === 0 ? 0 : Math.max(5, (item.steps / maxSteps) * 100);
          return (
            <View key={item.date} style={styles.weekColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${height}%`,
                      backgroundColor: item.isToday ? ORANGE : INK,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekDay, item.isToday && { color: ORANGE }]}>
                {item.day}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.smallMuted, { marginTop: 8 }]}>
        Daily step totals · locally saved activity
      </Text>

      <Pressable
        onPress={() => showMessage('Competition preview', 'Live rankings are demo data and are not connected to real players yet.')}
        style={({ pressed }) => [
          styles.darkFeature,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.featureText}>
          <Label style={{ color: '#B9B7BB' }}>CURRENT POSITION</Label>
          <Text style={styles.featureTitle}>Keep climbing.</Text>
          <Text style={styles.featureSubtitle}>
            Your friends are moving today.
          </Text>
        </View>
        <View style={styles.featureIcon}>
          <Trophy color={ORANGE} size={25} />
        </View>
        <ArrowRight color={WHITE} size={18} />
      </Pressable>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Activity streak</Text>
        <Activity size={18} color={ORANGE} />
      </View>
      <View style={styles.streakCard}>
        <View>
          <Text style={styles.streakNumber}>{String(streakDays).padStart(2, "0")} DAYS</Text>
          <Text style={styles.smallMuted}>Consistency beats intensity.</Text>
        </View>
        <Dots />
      </View>
    </ScrollView>
  );
}

function CompeteScreen() {
  const [filter, setFilter] = useState<'GLOBAL' | 'FRIENDS' | 'WEEKLY'>('GLOBAL');

  const globalPeople = [
    ['Aryan', '@aryan.moves', '34,221'],
    ['Meera', '@meera.walks', '31,904'],
    ['Rohit', '@rohit.steps', '28,611'],
    ['You', '@your.username', '22,836'],
    ['Sneha', '@sneha.moves', '21,442'],
    ['Karan', '@karan.walks', '20,331'],
  ];

  const friendsPeople = [
    ['You', '@your.username', '22,836'],
    ['Aryan', '@aryan.moves', '18,904'],
    ['Meera', '@meera.walks', '16,221'],
  ];

  const weeklyPeople = [
    ['Meera', '@meera.walks', '148,420'],
    ['Aryan', '@aryan.moves', '132,810'],
    ['You', '@your.username', '119,640'],
    ['Rohit', '@rohit.steps', '105,230'],
    ['Sneha', '@sneha.moves', '98,440'],
  ];

  const source = filter === 'FRIENDS'
    ? friendsPeople
    : filter === 'WEEKLY'
      ? weeklyPeople
      : globalPeople;

  const people = source
    .slice()
    .sort((a, b) => Number(b[2].replace(/,/g, '')) - Number(a[2].replace(/,/g, '')))
    .map((person, index) => [
      String(index + 1).padStart(2, '0'),
      person[0],
      person[1],
      person[2],
    ]);

  const yourIndex = people.findIndex((person) => person[1] === 'You');
  const yourRank = yourIndex >= 0 ? yourIndex + 1 : null;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Label>THE ARENA</Label>
      <Text style={styles.pageTitle}>Compete.</Text>
      <Text style={styles.pageSubtitle}>
        Every step moves you forward.
      </Text>

      <View style={styles.segment}>
        {(['GLOBAL', 'FRIENDS', 'WEEKLY'] as const).map((item) => {
          const selected = filter === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item)}
              style={[styles.segmentOption, selected && styles.segmentActive]}
            >
              <Text style={selected ? styles.segmentActiveText : styles.segmentText}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rankCard}>
        <Label>YOUR CURRENT RANK</Label>
        <View style={styles.rankRow}>
          <Text style={styles.rankBig}>{yourRank ? `#${String(yourRank).padStart(2, "0")}` : "—"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rankName}>{yourRank ? `You are #${String(yourRank).padStart(2, "0")}` : "Not ranked"}</Text>
            <Text style={styles.smallMuted}>
              {filter === 'WEEKLY' ? 'Weekly step totals · demo data' : filter === 'FRIENDS' ? 'Friend standings · demo data' : 'Global standings · demo data'}
            </Text>
          </View>
          <ChartNoAxesColumn size={23} color={ORANGE} />
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{filter === 'WEEKLY' ? 'This week' : filter === 'FRIENDS' ? 'Friends leaderboard' : "Today's leaders"}</Text>
        <Label>STEPS</Label>
      </View>

      {people.map(([rank, name, handle, score]) => (
        <View
          key={rank}
          style={[styles.personRow, name === 'You' && styles.youRow]}
        >
          <Text style={[styles.rankIndex, name === 'You' && { color: ORANGE }]}>
            {rank}
          </Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{name}</Text>
            <Text style={styles.personHandle}>{handle}</Text>
          </View>
          <Text style={styles.personScore}>{score}</Text>
        </View>
      ))}

      <Pressable style={styles.primaryButton}>
        <Users size={18} color={WHITE} />
        <Text style={styles.primaryButtonText}>Find friends</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChallengesScreen({
  steps,
  streakDays,
  goalDays,
  earnedBadgeIds,
}: {
  steps: number;
  streakDays: number;
  goalDays: number;
  earnedBadgeIds: string[];
}) {
  const [joined, setJoined] = useState(false);
  const [challengeStorageLoaded, setChallengeStorageLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem('steparena.dailyChallenge.joined')
      .then((value) => {
        if (active) setJoined(value === 'true');
      })
      .catch((error) => {
        console.warn('Could not load daily challenge state:', error);
      })
      .finally(() => {
        if (active) setChallengeStorageLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleDailyChallenge = async () => {
    if (!challengeStorageLoaded) return;

    const nextJoined = !joined;
    setJoined(nextJoined);

    try {
      await AsyncStorage.setItem(
        'steparena.dailyChallenge.joined',
        String(nextJoined)
      );
    } catch (error) {
      console.warn('Could not save daily challenge state:', error);
      showMessage(
        'Save failed',
        'Your change could not be saved on this device. Please try again.'
      );
    }
  };
  const demoSteps = steps;
  const dailyGoal = 10000;
  const progress = Math.min(demoSteps / dailyGoal, 1);
  const completed = demoSteps >= dailyGoal;
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Label>MAKE EVERY STEP COUNT</Label>
      <Text style={styles.pageTitle}>Challenges.</Text>
      <Text style={styles.pageSubtitle}>
        A little competition goes a long way.
      </Text>

      <View style={styles.challengeCard}>
        <Label>01 / DAILY CHALLENGE</Label>
        <Text style={styles.challengeTitle}>10K steps.</Text>
        <Text style={styles.smallMuted}>
          {joined ? 'You joined this local demo challenge.' : 'Join the challenge and aim for 10,000 steps today.'}
        </Text>
        <View style={styles.challengeDots}>
          <View style={styles.challengeProgressTrack}>
            <View style={[styles.challengeProgressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.challengeProgress}>
            {demoSteps.toLocaleString('en-US')} / {dailyGoal.toLocaleString('en-US')}
          </Text>
        </View>
        <Text style={[styles.smallMuted, { marginTop: 8 }]}>
          {completed
            ? 'Goal reached ✓ · demo steps'
            : joined
              ? 'Joined · progress uses demo steps'
              : 'Progress preview · demo steps'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: joined, disabled: !challengeStorageLoaded }}
          disabled={!challengeStorageLoaded}
          onPress={toggleDailyChallenge}
          style={({ pressed }) => [
            styles.challengeJoinButton,
            joined && styles.challengeLeaveButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.challengeJoinText, joined && styles.challengeLeaveText]}>
            {joined ? 'Leave challenge' : 'Join daily challenge'}
          </Text>
          <ArrowRight size={17} color={joined ? INK : WHITE} />
        </Pressable>
        <View style={styles.thinLine} />
        <View style={styles.inlineBetween}>
          <Text style={styles.smallMuted}>Your current streak · 10K-step days</Text>
          <Text style={styles.personName}>{streakDays} {streakDays === 1 ? "day" : "days"}</Text>
        </View>
      </View>

      <View style={styles.darkChallenge}>
        <Label style={{ color: '#C1BFC3' }}>02 / FRIEND CHALLENGE</Label>
        <Text style={[styles.challengeTitle, { color: WHITE }]}>
          Move together.
        </Text>
        <Text style={styles.darkSubtitle}>
          Create a private challenge and invite your friends.
        </Text>
        <Pressable
          style={styles.lightButton}
          onPress={() => showMessage('Create challenge', 'Online challenges are not implemented yet. No challenge has been created.')}
        >
          <Text style={styles.lightButtonText}>Create challenge</Text>
          <ArrowRight size={18} color={INK} />
        </Pressable>
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
          const progress = Math.min(progressValue / achievement.threshold, 1);

          return (
            <View
              key={achievement.id}
              style={[
                styles.achievementRow,
                { backgroundColor: WHITE, borderRadius: 14, padding: 12 },
              ]}
            >
              <View
                style={[
                  styles.achievementCircle,
                  { backgroundColor: unlocked ? '#FFF0EC' : '#EFEDF0' },
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
                    backgroundColor: '#EFEDF0',
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
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ProfileScreen({
  badgeCount,
  records,
}: {
  badgeCount: number;
  records: ReturnType<typeof calculatePersonalRecords>;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <Label>YOUR SPACE</Label>
        <Pressable style={styles.roundButton}>
          <Settings size={20} color={INK} />
        </Pressable>
      </View>

      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}>
          <UserRound size={32} color={INK} />
        </View>
        <Text style={styles.profileName}>Your name</Text>
        <Text style={styles.profileHandle}>@your.username</Text>
        <Text style={styles.profileHint}>
          Your journey, one step at a time.
        </Text>
      </View>

      <View style={styles.profileStats}>
        <Metric value="12" label="FOLLOWING" />
        <View style={styles.metricDivider} />
        <Metric value="28" label="FOLLOWERS" />
        <View style={styles.metricDivider} />
        <Metric value={String(badgeCount).padStart(2, "0")} label="BADGES" />
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Personal records</Text>
        <Trophy color={ORANGE} size={19} />
      </View>

      <View
        style={{
          backgroundColor: WHITE,
          borderRadius: 17,
          padding: 17,
          gap: 15,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>TOTAL STEPS</Text>
            <Text style={styles.recordValue}>
              {records.totalSteps.toLocaleString('en-US')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>BEST DAY</Text>
            <Text style={styles.recordValue}>
              {records.bestDay.toLocaleString('en-US')}
            </Text>
          </View>
        </View>

        <View style={styles.thinLine} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>LONGEST STREAK</Text>
            <Text style={styles.recordValue}>
              {records.longestStreak} {records.longestStreak === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallMuted}>10K DAYS</Text>
            <Text style={styles.recordValue}>{records.goalDays}</Text>
          </View>
        </View>

        <Text style={styles.smallMuted}>
          Based on {records.recordedDays} recorded days · available history only
        </Text>
      </View>

      {[
        [Activity, 'Activity history', 'Your steps and personal records'],
        [Trophy, 'Achievements', 'Your milestones and streaks'],
        [Heart, 'Health preferences', 'Your goals and permissions'],
        [Moon, 'Appearance', 'Light and dark mode'],
        [Settings, 'Settings', 'Privacy, account and support'],
      ].map(([Icon, title, subtitle]: any) => (
        <Pressable key={title} style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Icon size={19} color={INK} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{title}</Text>
            <Text style={styles.smallMuted}>{subtitle}</Text>
          </View>
          <ArrowRight size={17} color={MUTED} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [dailySteps, setDailySteps] = useState(22836);
  const dailyStepsRef = useRef(22836);
  const [activityHistory, setActivityHistory] = useState<DailyActivity[]>([]);
  const activityHistoryRef = useRef<DailyActivity[]>([]);
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([]);
  const [badgesLoaded, setBadgesLoaded] = useState(false);
  const [celebrationAchievement, setCelebrationAchievement] =
    useState<(typeof ACHIEVEMENTS)[number] | null>(null);
  const celebrationScale = useRef(new Animated.Value(0.85)).current;
  const seenUnlocks = useRef<Set<string> | null>(null);

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

    AsyncStorage.getItem('steparena.dailyActivity')
      .then((raw) => {
        if (!active || !raw) return;

        try {
          const saved = JSON.parse(raw);
          const loadedHistory: DailyActivity[] = Array.isArray(saved.history)
            ? saved.history.filter(
                (entry: any) =>
                  typeof entry?.date === 'string' &&
                  /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
                  Number.isInteger(entry.steps) &&
                  entry.steps >= 0
              )
            : [];

          const archivedHistory = [...loadedHistory];

          // One-time recovery of the user's confirmed October 28 total.
          // Replace an incorrect entry for that date, without duplicating it.
          const recoveredDay = { date: '2026-10-28', steps: 23125 };
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
            const previousDay = { date: saved.date, steps: saved.steps };

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
        } catch {
          console.warn('Saved daily activity was invalid; starting fresh.');
          dailyStepsRef.current = 0;
          setDailySteps(0);
          activityHistoryRef.current = [];
          setActivityHistory([]);
        }
      })
      .catch((error) => {
        console.warn('Could not load daily activity:', error);
      })
      .finally(() => {
        if (active) setStepsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!stepsLoaded) return;

    const today = getTodayKey();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 364);
    const cutoffKey = localDateKey(cutoff);

    const nextHistory = [
      ...activityHistory.filter((entry) => entry.date !== today),
      { date: today, steps: dailySteps },
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
        history: nextHistory,
      })
    ).catch((error) => {
      console.warn('Could not save daily activity:', error);
    });
  }, [dailySteps, activityHistory, stepsLoaded]);

  const weekData = buildActivityWeek(activityHistory, dailySteps);
  const streakDays = calculateStreak(activityHistory, dailySteps);
  const goalDays = countGoalDays(activityHistory, dailySteps);
  const personalRecords = calculatePersonalRecords(activityHistory, dailySteps);
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
    Animated.spring(celebrationScale, {
      toValue: 1,
      damping: 12,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [celebrationAchievement, celebrationScale]);

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

  const addDemoSteps = (amount: number) => {
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
      { date: today, steps: nextSteps },
    ]
      .filter((entry) => entry.date >= cutoffKey && entry.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    activityHistoryRef.current = nextHistory;
    setActivityHistory(nextHistory);

    AsyncStorage.setItem(
      'steparena.dailyActivity',
      JSON.stringify({ date: today, steps: nextSteps, history: nextHistory })
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
        }
      | undefined;

    const syncNativeSteps = async () => {
      if (!active || !nativeSteps || nativeSyncInProgress.current) return;

      nativeSyncInProgress.current = true;
      try {
        const total = await nativeSteps.getDailySteps();
        if (!active || !Number.isFinite(total) || total < 0) return;

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

        // First sync of a day establishes a baseline; it must not import
        // an old day's native counter into today's JavaScript total.
        if (
          previous?.date === today &&
          typeof previous.total === 'number' &&
          Number.isInteger(previous.total) &&
          total >= previous.total
        ) {
          const difference = total - previous.total;
          if (difference > 0) addDemoSteps(difference);
        }

        await AsyncStorage.setItem(
          syncKey,
          JSON.stringify({ date: today, total })
        );
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

        // Establish the initial baseline promptly, then catch up periodically
        // while foregrounded. The Android service continues independently.
        await syncNativeSteps();
        interval = setInterval(() => void syncNativeSteps(), 10000);

        appStateSubscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') void syncNativeSteps();
        });

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

  const navigate = (tab: Tab) => {
    if (tab === activeTab || busy.current) return;
    busy.current = true;

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: -8,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveTab(tab);
      slide.setValue(8);
      Animated.parallel([
        Animated.spring(fade, {
          toValue: 1,
          damping: 20,
          stiffness: 190,
          useNativeDriver: true,
        }),
        Animated.spring(slide, {
          toValue: 0,
          damping: 20,
          stiffness: 190,
          useNativeDriver: true,
        }),
      ]).start(() => {
        busy.current = false;
      });
    });
  };

  const screens: Record<Tab, React.ReactNode> = {
    Home: <HomeScreen steps={dailySteps} onAddSteps={addDemoSteps} weekData={weekData} streakDays={streakDays} />,
    Compete: <CompeteScreen />,
    Challenges: (
      <ChallengesScreen
        steps={dailySteps}
        streakDays={streakDays}
        goalDays={goalDays}
        earnedBadgeIds={earnedBadgeIds}
      />
    ),
    Profile: <ProfileScreen badgeCount={earnedBadgeIds.length} records={personalRecords} />,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.app}>
        <Animated.View
          style={[
            styles.screen,
            { opacity: fade, transform: [{ translateY: slide }] },
          ]}
        >
          {screens[activeTab]}
        </Animated.View>

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
                transform: [{ scale: celebrationScale }],
              }}
            >
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: '#FFF0EC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: '#FFD2C9',
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
                  {selected && <View style={styles.navDot} />}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER },
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
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
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
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    paddingVertical: 18,
    marginTop: 7,
  },
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
  weekCard: {
    flexDirection: 'row',
    height: 130,
    borderRadius: 17,
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 12,
    backgroundColor: WHITE,
    justifyContent: 'space-between',
  },
  weekColumn: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: {
    flex: 1,
    width: 15,
    backgroundColor: '#EFEDF0',
    borderRadius: 9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 9 },
  weekDay: { fontSize: 10, color: MUTED },
  darkFeature: {
    marginTop: 17,
    backgroundColor: INK,
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
    backgroundColor: WHITE,
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
    backgroundColor: '#E5E3E6',
    borderRadius: 25,
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  segmentOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 9 },
  segmentActive: {
    backgroundColor: INK,
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
  rankCard: { backgroundColor: WHITE, borderRadius: 17, padding: 18 },
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
    backgroundColor: '#E8E5E7',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
  },
  rankIndex: { width: 23, color: MUTED, fontSize: 11 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0DDE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 13, fontWeight: '600', color: INK },
  personName: { fontSize: 13, color: INK, fontWeight: '500' },
  personHandle: { fontSize: 10, color: MUTED, marginTop: 3 },
  personScore: { color: INK, fontSize: 12, fontVariant: ['tabular-nums'] },
  primaryButton: {
    backgroundColor: INK,
    borderRadius: 28,
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 23,
  },
  primaryButtonText: { color: WHITE, fontSize: 13, fontWeight: '500' },
  challengeCard: {
    marginTop: 5,
    backgroundColor: WHITE,
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
    backgroundColor: '#E5E2E5',
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
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeLeaveButton: {
    backgroundColor: '#E8E5E7',
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
    backgroundColor: INK,
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
  },
  darkSubtitle: { color: '#C1BFC3', fontSize: 12, lineHeight: 19 },
  lightButton: {
    marginTop: 23,
    backgroundColor: WHITE,
    borderRadius: 28,
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightButtonText: { color: INK, fontSize: 12, fontWeight: '500' },
  recordValue: {
    color: INK,
    fontSize: 23,
    fontWeight: '400',
    letterSpacing: -0.6,
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
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
  profileHero: { alignItems: 'center', paddingTop: 28, paddingBottom: 30 },
  profileAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#E1DEE1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  profileName: { fontSize: 23, color: INK, fontWeight: '400' },
  profileHandle: { color: MUTED, fontSize: 12, marginTop: 6 },
  profileHint: { color: MUTED, fontSize: 11, marginTop: 14 },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 19,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    marginBottom: 17,
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
    backgroundColor: WHITE,
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
