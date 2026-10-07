import { describe,it,expect } from 'vitest';
import {routineItem,quantityUsed,validateDetail} from './shiftWorkflow';
describe('shift entry rules',()=>{
 it('deducts actual contrast and wastage without rounding to bottles',()=>expect(quantityUsed({used:71.25,waste:2.5})).toBe(73.75));
 it('requires an explicit review before finishing',()=>expect(validateDetail('gloves_pack',{used:0},true)).toMatch(/Review/));
 it('does not treat a reviewed blank as zero',()=>expect(validateDetail('gloves_pack',{reviewed:true},true)).toMatch(/blank/));
 it('requires patients separately for films and contrast',()=>{
  expect(validateDetail('film1210',{used:3},false)).toMatch(/patients/);
  expect(validateDetail('ct_contrast',{used:70,patients:2,waste:10},false)).toBeNull();
 });
 it('keeps paper administrative and contrasts appropriate to the room',()=>{
  expect(routineItem('a4_paper','CT')).toBe(false);
  expect(routineItem('gloves_pack','Mammography')).toBe(true);
  expect(routineItem('ct_contrast','MRI')).toBe(false);
 });
});
