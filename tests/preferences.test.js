import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreferences } from '../frontend/src/preferences.js';
import { connectionDefaults } from '../frontend/src/connection.js';

test('invalid browser preferences fall back safely, including valid JSON null and scalars',()=>{
  for(const raw of ['null','false','42','"saved"','[]','{invalid','']){
    assert.deepEqual(readPreferences('bla.settings',{getItem:()=>raw}),{});
    assert.deepEqual(readPreferences('bla.connections',{getItem:()=>raw}),{});
  }
  assert.deepEqual(readPreferences('bla.settings',{getItem:()=>'{"fov":93}'}),{fov:93});
});

test('blocked browser storage does not prevent startup',()=>{
  assert.deepEqual(readPreferences('bla.settings',{getItem(){throw new Error('Storage is disabled');}}),{});
});

test('runtime connection settings inherit build defaults and can explicitly restore the same-origin proxy',()=>{
  const build={VITE_NETWORK_MODE:'public',VITE_BACKEND_URL:'https://api.example'};
  assert.deepEqual(connectionDefaults({networkMode:null,backendUrl:null},build),{networkMode:'public',backendUrl:'https://api.example'});
  assert.deepEqual(connectionDefaults({networkMode:'lan',backendUrl:''},build),{networkMode:'lan',backendUrl:''});
  assert.deepEqual(connectionDefaults({networkMode:'public',backendUrl:'https://rooms.example'},build),{networkMode:'public',backendUrl:'https://rooms.example'});
  assert.deepEqual(connectionDefaults(null,{}),{networkMode:'lan',backendUrl:''});
  assert.deepEqual(connectionDefaults({backendUrl:42},{}),{networkMode:'lan',backendUrl:''});
});
