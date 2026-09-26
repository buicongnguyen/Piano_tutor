// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {App} from './app';

it('background pause stays paused instead of resuming a manually paused game',()=>{
  const app=Object.create(App.prototype) as App;
  const pause=vi.fn();
  Object.assign(app,{state:'play',session:{done:false,paused:true,pause},resume:vi.fn()});
  // visibilitychange calls this same method when document.hidden is true.
  app.pause(); app.pause();
  expect(app.resume).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
});
