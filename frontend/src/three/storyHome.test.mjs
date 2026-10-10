import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildEstate } from './world/buildings.js';
import { buildStoryHome, storyBatteryPercent } from './storyHome.js';
const estate = buildEstate();
const position = estate.group.children[0].geometry.attributes.position;
const a = new THREE.Vector3(), b = a.clone(), c = a.clone();
// The six roof triangles follow the box's 36 vertices.
for (let i = 36; i < 54; i += 3) {
  a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
  const center = a.clone().add(b).add(c).divideScalar(3);
  const normal = b.sub(a).cross(c.sub(a));
  assert.ok(i < 48 ? normal.y > 0 : normal.z * center.z > 0, 'Roof slopes and gables must face outwards');
}
const drawn = [];
const context = new Proxy({}, {get: (_target, key) => key === 'fillText' ? (text) => drawn.push(text) : () => {}});
globalThis.document = {createElement: () => ({width:0,height:0,getContext: () => context})};
const home = buildStoryHome(new THREE.Vector3());
home.update(89); assert.ok(drawn.includes('1%') && drawn.includes('Low battery'));
drawn.length = 0; home.update(96); assert.ok(drawn.includes('4%') && drawn.includes('Charging'));
drawn.length = 0; home.update(0); assert.ok(drawn.includes('1%') && drawn.includes('Low battery'));
assert.equal(storyBatteryPercent(98), 5);
const wires = home.group.children.filter(mesh => mesh.geometry?.type === 'TubeGeometry');
for (const wire of wires) for (const segment of wire.geometry.parameters.path.curves) {
  assert.ok(home.cablePoints.some(point => point.distanceTo(segment.v1) < 1e-9));
  assert.ok(home.cablePoints.some(point => point.distanceTo(segment.v2) < 1e-9));
}
assert.ok(home.cablePoints.at(-1).distanceTo(new THREE.Vector3(1.91,1.15,-.65)) < 1e-9, 'Energy must stop at the laptop power port');
home.dispose();
console.log('Story roof faces, battery charging/reset and shared physical-wire route passed.');

