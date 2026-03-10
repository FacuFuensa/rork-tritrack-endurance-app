import { Supplement, RecoveryOption, UserProfile, WorkoutConfig, GoalEvent } from '@/constants/types';
import Colors from '@/constants/colors';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Athlete',
  photoUri: '',
  eventName: 'Fitness',
  eventDate: '',
  showProgressPopup: true,
  activeEventId: '',
  onboardingComplete: false,
};

export const DEFAULT_WORKOUT_CONFIGS: WorkoutConfig[] = [
  {
    id: 'swim',
    name: 'Swim',
    emoji: '🏊',
    color: Colors.swim,
    darkColor: Colors.swimDark,
    distanceUnit: 'meters',
    fields: ['distance', 'time', 'laps'],
    isDefault: true,
    showInSummaries: true,
  },
  {
    id: 'bike',
    name: 'Bike',
    emoji: '🚴',
    color: Colors.bike,
    darkColor: Colors.bikeDark,
    distanceUnit: 'miles',
    fields: ['distance', 'time', 'elevation', 'avgSpeed'],
    isDefault: true,
    showInSummaries: true,
  },
  {
    id: 'run',
    name: 'Run',
    emoji: '🏃',
    color: Colors.run,
    darkColor: Colors.runDark,
    distanceUnit: 'miles',
    fields: ['distance', 'time', 'elevation'],
    isDefault: true,
    showInSummaries: true,
  },
];

export const PRESET_WORKOUTS: { name: string; emoji: string }[] = [
  { name: 'Gym', emoji: '🏋️' },
  { name: 'Yoga', emoji: '🧘' },
  { name: 'Basketball', emoji: '🏀' },
  { name: 'Soccer', emoji: '⚽' },
  { name: 'Tennis', emoji: '🎾' },
  { name: 'Boxing', emoji: '🥊' },
  { name: 'HIIT', emoji: '🔥' },
  { name: 'Rowing', emoji: '🚣' },
  { name: 'Hiking', emoji: '🥾' },
  { name: 'Climbing', emoji: '🧗' },
  { name: 'Skiing', emoji: '⛷️' },
  { name: 'Dancing', emoji: '💃' },
  { name: 'Martial Arts', emoji: '🥋' },
  { name: 'Volleyball', emoji: '🏐' },
  { name: 'Baseball', emoji: '⚾' },
  { name: 'Golf', emoji: '⛳' },
  { name: 'Surfing', emoji: '🏄' },
  { name: 'Skating', emoji: '⛸️' },
  { name: 'Bowling', emoji: '🎳' },
];

export const SPORT_FIELD_CONFIGS: Record<string, { fields: string[]; fieldLabels: Record<string, string> }> = {
  'Swim': {
    fields: ['distance', 'time', 'laps'],
    fieldLabels: {},
  },
  'Bike': {
    fields: ['distance', 'time', 'elevation', 'avgSpeed'],
    fieldLabels: {},
  },
  'Run': {
    fields: ['distance', 'time', 'elevation'],
    fieldLabels: {},
  },
  'Gym': {
    fields: ['exercises', 'sets', 'reps', 'time'],
    fieldLabels: { exercises: 'Exercises', sets: 'Sets', reps: 'Reps' },
  },
  'Yoga': {
    fields: ['time'],
    fieldLabels: {},
  },
  'Basketball': {
    fields: ['points', 'rebounds', 'assists', 'time'],
    fieldLabels: { points: 'Points', rebounds: 'Rebounds', assists: 'Assists' },
  },
  'Soccer': {
    fields: ['goals', 'assists', 'shots', 'time'],
    fieldLabels: { goals: 'Goals', assists: 'Assists', shots: 'Shots' },
  },
  'Tennis': {
    fields: ['setsWon', 'gamesWon', 'aces', 'time'],
    fieldLabels: { setsWon: 'Sets Won', gamesWon: 'Games Won', aces: 'Aces' },
  },
  'Boxing': {
    fields: ['rounds', 'time'],
    fieldLabels: { rounds: 'Rounds' },
  },
  'HIIT': {
    fields: ['rounds', 'calories', 'time'],
    fieldLabels: { rounds: 'Rounds', calories: 'Calories' },
  },
  'Rowing': {
    fields: ['distance', 'strokes', 'time'],
    fieldLabels: { strokes: 'Strokes' },
  },
  'Hiking': {
    fields: ['distance', 'elevation', 'time'],
    fieldLabels: {},
  },
  'Climbing': {
    fields: ['routes', 'time'],
    fieldLabels: { routes: 'Routes' },
  },
  'Skiing': {
    fields: ['runs', 'distance', 'elevation', 'time'],
    fieldLabels: { runs: 'Runs' },
  },
  'Dancing': {
    fields: ['time'],
    fieldLabels: {},
  },
  'Martial Arts': {
    fields: ['rounds', 'time'],
    fieldLabels: { rounds: 'Rounds' },
  },
  'Volleyball': {
    fields: ['points', 'aces', 'blocks', 'time'],
    fieldLabels: { points: 'Points', aces: 'Aces', blocks: 'Blocks' },
  },
  'Baseball': {
    fields: ['atBats', 'hits', 'runs', 'rbis', 'time'],
    fieldLabels: { atBats: 'At Bats', hits: 'Hits', runs: 'Runs Scored', rbis: 'RBIs' },
  },
  'Golf': {
    fields: ['score', 'holes', 'putts', 'time'],
    fieldLabels: { score: 'Score', holes: 'Holes', putts: 'Putts' },
  },
  'Surfing': {
    fields: ['waves', 'time'],
    fieldLabels: { waves: 'Waves' },
  },
  'Skating': {
    fields: ['distance', 'time'],
    fieldLabels: {},
  },
  'Bowling': {
    fields: ['games', 'score', 'strikes', 'spares'],
    fieldLabels: { games: 'Games', score: 'Score', strikes: 'Strikes', spares: 'Spares' },
  },
};

export const WORKOUT_COLORS: string[] = [
  '#4FC3F7',
  '#FFB74D',
  '#EF5350',
  '#66BB6A',
  '#CE93D8',
  '#4DD0E1',
  '#FF8A65',
  '#AED581',
  '#F06292',
  '#90CAF9',
  '#FFD54F',
  '#80CBC4',
];

export const DEFAULT_SUPPLEMENTS: Supplement[] = [
  { id: 's_creatine', name: 'Creatine', dose: '5g', isCustom: false },
];

export const DEFAULT_RECOVERY: RecoveryOption[] = [
  { id: 'r_stretch', name: 'Stretching', weeklyGoal: 7 },
  { id: 'r_foam', name: 'Foam Roll', weeklyGoal: 3 },
  { id: 'r_ice', name: 'Ice Bath', weeklyGoal: 2 },
];

export const COMMON_SUPPLEMENTS: { name: string; dose: string }[] = [
  { name: 'Creatine', dose: '5g' },
  { name: 'Protein', dose: '30g' },
  { name: 'BCAA', dose: '5g' },
  { name: 'Caffeine', dose: '200mg' },
  { name: 'Omega-3', dose: '1000mg' },
  { name: 'Vitamin D', dose: '5000 IU' },
  { name: 'Vitamin C', dose: '1000mg' },
  { name: 'Magnesium', dose: '400mg' },
  { name: 'Zinc', dose: '30mg' },
  { name: 'Iron', dose: '18mg' },
  { name: 'Multivitamin', dose: '1 tab' },
  { name: 'Electrolytes', dose: '1 tab' },
  { name: 'Glutamine', dose: '5g' },
  { name: 'Collagen', dose: '10g' },
  { name: 'Beta-Alanine', dose: '3g' },
  { name: 'Ashwagandha', dose: '600mg' },
];

export const EVENT_TYPES: { label: string; goalEvent: GoalEvent }[] = [
  {
    label: 'Ironman',
    goalEvent: {
      type: 'Ironman',
      distances: [
        { discipline: 'swim', distance: 3860, unit: 'meters' },
        { discipline: 'bike', distance: 112, unit: 'miles' },
        { discipline: 'run', distance: 26.2, unit: 'miles' },
      ],
    },
  },
  {
    label: 'Ironman 70.3',
    goalEvent: {
      type: 'Ironman 70.3',
      distances: [
        { discipline: 'swim', distance: 1930, unit: 'meters' },
        { discipline: 'bike', distance: 56, unit: 'miles' },
        { discipline: 'run', distance: 13.1, unit: 'miles' },
      ],
    },
  },
  {
    label: 'Triathlon Olympic',
    goalEvent: {
      type: 'Triathlon Olympic',
      distances: [
        { discipline: 'swim', distance: 1500, unit: 'meters' },
        { discipline: 'bike', distance: 40, unit: 'km' },
        { discipline: 'run', distance: 10, unit: 'km' },
      ],
    },
  },
  {
    label: 'Triathlon Sprint',
    goalEvent: {
      type: 'Triathlon Sprint',
      distances: [
        { discipline: 'swim', distance: 750, unit: 'meters' },
        { discipline: 'bike', distance: 20, unit: 'km' },
        { discipline: 'run', distance: 5, unit: 'km' },
      ],
    },
  },
  {
    label: 'Marathon',
    goalEvent: {
      type: 'Marathon',
      distances: [
        { discipline: 'run', distance: 26.2, unit: 'miles' },
      ],
    },
  },
  {
    label: 'Half Marathon',
    goalEvent: {
      type: 'Half Marathon',
      distances: [
        { discipline: 'run', distance: 13.1, unit: 'miles' },
      ],
    },
  },
  {
    label: '10K',
    goalEvent: {
      type: '10K',
      distances: [
        { discipline: 'run', distance: 10, unit: 'km' },
      ],
    },
  },
  {
    label: '5K',
    goalEvent: {
      type: '5K',
      distances: [
        { discipline: 'run', distance: 5, unit: 'km' },
      ],
    },
  },
];

export const CUSTOM_EVENT_TYPE = 'Custom';

export const RECOVERY_PRESETS: string[] = [
  'Foam Roll',
  'Sauna',
  'Massage',
  'Cryo',
  'Nap',
  'Meditation',
  'Stretching',
  'Ice Bath',
  'Yoga',
  'Compression',
  'Physical Therapy',
];
