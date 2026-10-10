import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {nightReadability,skyState} from './environment.js';
import {walkAt} from './walk.js';
import {buildInteriors,buildWalkHatch} from './interiors.js';
import {splitShell} from './splitShell.js';
for(const elevation of [-20,-8,-2,15])for(const cloud of [0,1]) {
 const sky=skyState({elevation:elevation*Math.PI/180,cloud,rain:.5,fog:.5});
 const snapshot=JSON.stringify(sky);const fill=nightReadability(sky);
 assert.equal(JSON.stringify(sky),snapshot,'display fill must not mutate weather/sky');
 assert.equal(nightReadability(sky,1).fill,0);assert.equal(nightReadability(sky,1).ambient,0);
 if(elevation>=-2)assert.equal(fill.fill,0);
 if(elevation<=-12)assert.ok(sky.hemiIntensity+fill.ambient>=.85);
}
const bytes=await readFile(new URL('../../public/models/ace-turbine.glb',import.meta.url));
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const root=gltf.scene,yaw=root.getObjectByName('Yaw'),internals=root.getObjectByName('ACE_NacelleInternals');
const towerPivot=new THREE.Group();root.add(towerPivot);
const tower=root.getObjectByName("ACE_Tower");towerPivot.add(tower);
splitShell(tower);splitShell(root.getObjectByName("ACE_NacelleShell"));
buildInteriors({yaw},towerPivot);
root.traverse(o=>{if(o.isMesh && !o.material)o.material=new THREE.MeshBasicMaterial();});
const hatch=buildWalkHatch({root,yaw,nacelleInternals:internals});
const eye=new THREE.Vector3(),look=new THREE.Vector3(),closest=new THREE.Vector3(),tri=new THREE.Triangle();

let minimum=Infinity;
for(const bearing of [0,90,215]) {
 const rotation=(bearing-215)*Math.PI/180;yaw.rotation.y=towerPivot.rotation.y=rotation;root.updateMatrixWorld(true);hatch(true);
 const meshes=[];
 root.traverse(o=>{
  if(!o.isMesh || o.name.includes('Blade'))return;
  if(!o.isInstancedMesh){meshes.push(o);return;}
  for(let i=0;i<o.count;i++){
   const instance=new THREE.Matrix4();o.getMatrixAt(i,instance);
   meshes.push({name:o.name+" instance "+i,geometry:o.geometry,material:o.material,matrixWorld:o.matrixWorld.clone().multiply(instance)});
  }
 });
 for(let progress=.8;progress<=1.00001;progress+=.002) {
  hatch(true, progress > .93);
  walkAt(progress,eye,look);eye.y += Math.sin(progress * 420) * .025;eye.applyAxisAngle(THREE.Object3D.DEFAULT_UP,rotation);let distance=Infinity, nearest="";
  for(const mesh of meshes) {
   const geometry=mesh.geometry,positions=geometry.attributes.position,index=geometry.index,count=index?.count??positions.count;
   for(let i=0;i<count;i+=3) {
    tri.a.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
    tri.b.fromBufferAttribute(positions,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
    tri.c.fromBufferAttribute(positions,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
    tri.closestPointToPoint(eye,closest);
    if(mesh.material.clipIntersection && mesh.material.clippingPlanes?.every(p=>p.distanceToPoint(closest)<0))continue;
    if(closest.distanceTo(eye)<distance){distance=closest.distanceTo(eye);nearest=mesh.name+JSON.stringify(closest.toArray())+" eye="+JSON.stringify(eye.toArray());}
   }
  }
  minimum=Math.min(minimum,distance);
  assert.ok(distance>.15,`Camera clearance ${distance.toFixed(3)} m at ${progress.toFixed(3)}, yaw ${bearing}: ${nearest}`);
 }
}
hatch(false);internals.traverse(o=>{if(o.isMesh)assert.ok(!o.material.clippingPlanes?.length,'hatch restored on exit');});
walkAt(1,eye,look);assert.ok(eye.x < -6 && eye.z > 1,'arrival is in service aisle');
console.log(`Display lighting invariants and loaded-mesh hatch/room clearance passed; minimum ${minimum.toFixed(3)} m.`);
