from pathlib import Path
from datetime import datetime
import shutil
import sys

root = Path.cwd()
app = root / 'App.tsx'
if not app.exists():
    print('ERROR: Run this script from ~/Projects/StepArena (the folder containing App.tsx).')
    sys.exit(1)

required_assets = [root / 'assets' / 'wordmark' / f'light-{i:02d}-{letter}.png' for i, letter in enumerate('steparena', 1)]
missing = [str(p.relative_to(root)) for p in required_assets if not p.exists()]
if missing:
    print('ERROR: Missing wordmark assets. Extract steparena-wordmark-assets.zip into the project root first:')
    print('\n'.join(missing))
    sys.exit(1)

s = app.read_text()
if 'INTRO_WORDMARK_LETTERS' in s:
    print('Intro wordmark appears to be already patched; no changes made.')
    sys.exit(0)

old_letters = '''              {'STEPARENA'.split('').map((letter, index) => (
                <Animated.Text
                  key={`${letter}-${index}`}
                  style={{
                    color: INK,
                    fontSize: 21,
                    fontWeight: '800',
                    letterSpacing: 2.5,
                    opacity: introLetterValues[index],
                    transform: [{
                      translateY: introLetterValues[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [9, 0],
                      }),
                    }],
                  }}
                >
                  {letter}
                </Animated.Text>
              ))}'''
new_letters = '''              {INTRO_WORDMARK_LETTERS.map((source, index) => (
                <Animated.Image
                  key={`wordmark-${index}`}
                  source={source}
                  resizeMode="contain"
                  style={{
                    width: 32,
                    height: 32,
                    marginHorizontal: 1,
                    opacity: introLetterValues[index],
                    transform: [{
                      translateY: introLetterValues[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [9, 0],
                      }),
                    }],
                  }}
                />
              ))}'''

if s.count(old_letters) != 1:
    print('ERROR: Could not uniquely locate the current STEPARENA text animation. No changes made.')
    print('Please share the current intro overlay around lines 1570–1620.')
    sys.exit(1)
if s.count('export default function App() {') != 1:
    print('ERROR: Could not uniquely locate App component. No changes made.')
    sys.exit(1)

asset_const = '''const INTRO_WORDMARK_LETTERS = [
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

'''
s = s.replace('export default function App() {', asset_const + 'export default function App() {', 1)
s = s.replace(old_letters, new_letters, 1)

old_ref = '''  const introLetterValues = useRef(
    'STEPARENA'.split('').map(() => new Animated.Value(0))
  ).current;
'''
new_ref = old_ref + '''  const introAccentWidth = useRef(new Animated.Value(4)).current;
'''
if s.count(old_ref) != 1:
    print('ERROR: Could not uniquely locate intro letter animation values. No changes made.')
    sys.exit(1)
s = s.replace(old_ref, new_ref, 1)

old_sequence = '''      lettersEntrance,
      Animated.delay(420),
      Animated.timing(introOpacity, {
'''
new_sequence = '''      lettersEntrance,
      Animated.timing(introAccentWidth, {
        toValue: 38,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.delay(240),
      Animated.timing(introOpacity, {
'''
if s.count(old_sequence) != 1:
    print('ERROR: Could not uniquely locate intro sequence. No changes made.')
    sys.exit(1)
s = s.replace(old_sequence, new_sequence, 1)

old_dep = '''    introRunnerScale,
    introLetterValues,
  ]);
'''
new_dep = '''    introRunnerScale,
    introLetterValues,
    introAccentWidth,
  ]);
'''
if s.count(old_dep) != 1:
    print('ERROR: Could not uniquely locate intro effect dependencies. No changes made.')
    sys.exit(1)
s = s.replace(old_dep, new_dep, 1)

old_underline = '''                width: 38,
                height: 3,
                borderRadius: 2,
                backgroundColor: ORANGE,
                marginTop: 19,
'''
new_underline = '''                width: introAccentWidth,
                height: 3,
                borderRadius: 2,
                backgroundColor: ORANGE,
                marginTop: 19,
'''
if s.count(old_underline) != 1:
    print('ERROR: Could not uniquely locate orange intro accent. No changes made.')
    sys.exit(1)
s = s.replace(old_underline, new_underline, 1)

backup = app.with_name(f"App.tsx.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
shutil.copy2(app, backup)
app.write_text(s)
print(f'Updated intro to use the original dot-matrix letter artwork. Backup: {backup.name}')
print('The counter, weekly chart, progress ring, and saved activity logic were not edited.')
