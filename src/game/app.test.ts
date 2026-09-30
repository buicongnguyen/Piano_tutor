// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {App} from './app';
import {emptySave} from './save';

it('background pause stays paused instead of resuming a manually paused game',()=>{
  const app=Object.create(App.prototype) as App;
  const pause=vi.fn();
  Object.assign(app,{state:'play',session:{done:false,paused:true,pause},resume:vi.fn()});
  // visibilitychange calls this same method when document.hidden is true.
  app.pause(); app.pause();
  expect(app.resume).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
});

it('calibration runs once even when the button is clicked again mid-run', async () => {
  const app = Object.create(App.prototype) as App;
  let runs = 0;
  let finish!: () => void;
  const settings = document.createElement('div');
  settings.innerHTML = '<button data-act="calibrate"></button>';
  Object.assign(app, {
    screens: { settings },
    runCalibration: () => {
      runs++;
      return new Promise<void>((r) => (finish = r));
    },
  });
  const first = app.calibrate();
  await app.calibrate();
  await app.calibrate();
  expect(runs).toBe(1);
  expect(settings.querySelector('button')!.disabled).toBe(true);
  finish();
  await first;
  expect(settings.querySelector('button')!.disabled).toBe(false);
});

type StoryApp = { tellDueStory: (state: string) => Promise<void>; dueStory: () => string[] };

function storyApp(records: Record<string, number>, seen: string[], openAll = false) {
  const app = Object.create(App.prototype) as App;
  const save = emptySave();
  save.seen = seen;
  save.settings.openAll = openAll;
  for (const [id, stars] of Object.entries(records))
    save.records[`${id}|easy|lanes`] = { stars, score: 1, accuracy: 1, rank: 'A', bestRank: 'A', fullCombo: false, plays: 1 };
  const told: string[] = [];
  Object.assign(app, {
    state: 'map',
    save,
    dialogue: { play: async () => undefined },
    persist: () => undefined,
  });
  const markSeen = (App.prototype as unknown as { markSeen: (k: string) => void }).markSeen;
  Object.assign(app, { markSeen: (k: string) => { told.push(k); markSeen.call(app, k); } });
  return { app: app as unknown as StoryApp, told };
}

const meadow = { 'morning-light': 3, 'room-to-breathe': 3, arirang: 3 };

it('tells a restore that was missed (retry, reload) on the next map visit, arrival first', async () => {
  const { app, told } = storyApp(meadow, []);
  await app.tellDueStory('map');
  expect(told).toEqual(['arrive:meadow', 'restore:meadow']);
  expect(app.dueStory()).toEqual([]);
});

it('keeps the story for real progress when every island is opened from settings', () => {
  // Garden restored with only its own stars: below its gate, so its scene waits.
  const garden = { 'fur-elise': 1, 'arabesque-no-1': 1, 'gymnopedie-no-1': 1, 'prelude-kumar': 1, 'variations-automne': 1, 'flat-kumar': 1 };
  const { app } = storyApp(garden, [], true);
  expect(app.dueStory()).toEqual([]);
  const { app: real } = storyApp({ ...meadow, ...garden, 'silent-night': 3 }, ['arrive:meadow', 'restore:meadow'], false);
  expect(real.dueStory()).toEqual(['arrive:garden', 'restore:garden']);
});
