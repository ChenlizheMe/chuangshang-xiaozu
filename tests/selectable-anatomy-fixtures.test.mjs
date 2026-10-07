import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
test('current UI fixtures use shipped mesh names, not merely recognizable anatomical aliases',()=>{
 for(const [alias,actual] of [['Sternum','Body of sternum'],['Lumbar vertebra L3','Vertebra L3'],['Cervical vertebra C3','Vertebra C3']]){
  assert.throws(()=>assertSelectableStructure(alias,'skeleton'),/must be a visible mesh/);assertSelectableStructure(actual,'skeleton');
 }
 assert.throws(()=>assertSelectableStructure('Masseter muscle.r','muscle'),/must be a visible mesh/);
 assertSelectableStructure('Superficial part of masseter.r','muscle');
});
test('inactive historical layers cannot silently count as current selectable UI models',()=>{
 assert.throws(()=>assertSelectableStructure('Frontal bone','nerve'),/No active model layer/);
});
