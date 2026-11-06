// the building, live. An olive field with both floors drawn in cream line, the same language as the giant outlined 808 on the onboarding
import * as THREE from 'three';

const OLIVE = 0x808808, DEEP = 0x404404, LIGHT = 0xE6E7CE, CREAM = 0xFCF7E6, GLOW = 0xD6DC55;
const FILL = 0x7A8208, GROUND = 0x8A9213;
// each floor is cut open at about head height, so you look down into the rooms
const CUT2 = [new THREE.Plane(new THREE.Vector3(0,0,-1), 14.6), new THREE.Plane(new THREE.Vector3(0,0,1), -11.45)];
const CUT1 = [new THREE.Plane(new THREE.Vector3(0,0,-1), 3.0), new THREE.Plane(new THREE.Vector3(0,0,1), .05)];
// where you'd stand to look at each space: out in its aisle
const AISLE = { east:208, west:-28, center:-68, crib:-90 };

export async function createFloor(){
  const [head, bin] = await Promise.all([
    fetch('floor/floor2.json').then(r => r.json()),
    fetch('floor/floor2.bin').then(r => r.arrayBuffer()),
  ]);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(OLIVE, 100, 400);
  const camera = new THREE.PerspectiveCamera(26, 1, 1, 1400);
  camera.up.set(0,0,1);

  // ---------- the model ----------
  const parts = {}, pickable = [];
  for (const [name, b] of Object.entries(head.buckets)){
    const raw = new Int16Array(bin, b.pos[0], b.pos[1]*3), pos = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) pos[i] = raw[i] / head.q;
    const attr = new THREE.BufferAttribute(pos, 3), cut = name==='ground' ? CUT1 : CUT2;
    const gm = new THREE.BufferGeometry(); gm.setAttribute('position', attr); gm.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, b.tri[0], b.tri[1]), 1));
    const gl = new THREE.BufferGeometry(); gl.setAttribute('position', attr); gl.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, b.line[0], b.line[1]), 1));
    const mm = new THREE.MeshBasicMaterial({ color:FILL, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1, clippingPlanes:cut });
    const lm = new THREE.LineBasicMaterial({ color:CREAM, transparent:true, opacity:.5, clippingPlanes:cut });
    // every line drawn twice, the second pass a little off, the way her pencil restates
    const lm2 = lm.clone(), mesh = new THREE.Mesh(gm, mm), seg = new THREE.LineSegments(gl, lm), seg2 = new THREE.LineSegments(gl, lm2);
    seg2.position.set(.14, -.1, .05);
    mesh.name = name; scene.add(mesh, seg, seg2);
    if (name!=='ground') pickable.push(mesh);
    parts[name] = { mm, lm, lm2, box:b, fill:new THREE.Color(FILL), line:new THREE.Color(CREAM), op:.5 };
  }

  // ---------- how it looks: which space is chosen, and what each machine is doing ----------
  let chosen = null, unitState = {}, toolDefault = 'idle';
  function restyle(){
    for (const [name, p] of Object.entries(parts)){
      if (name==='ground'){ p.fill.set(FILL); p.line.set(CREAM); p.op = chosen ? .1 : .24; continue; }
      if (name.startsWith('t_')){
        const s = unitState[name] || toolDefault;
        if (s==='open'){ p.fill.set(GLOW); p.line.set(DEEP); p.op = 1; }
        else if (s==='busy'){ p.fill.set(0xA7AB7E); p.line.set(DEEP); p.op = .5; }
        else if (s==='dim'){ p.fill.set(chosen ? 0xD3D6A8 : FILL); p.line.set(chosen ? DEEP : CREAM); p.op = .3; }
        else { p.fill.set(0x6A7107); p.line.set(CREAM); p.op = .95; }
        continue;
      }
      const isFloor = name.startsWith('floor_'), zone = isFloor ? name.slice(6) : name, on = chosen===zone;
      if (chosen && on){ p.fill.set(isFloor ? LIGHT : 0xD3D6A8); p.line.set(DEEP); p.op = .5; }
      else { p.fill.set(isFloor ? GROUND : FILL); p.line.set(CREAM); p.op = chosen ? .16 : .5; }
    }
  }
  restyle();

  // ---------- the camera: everything eases, nothing jumps ----------
  const now = { t:new THREE.Vector3(0,-8,8), d:300, az:-90, el:42 }, want = { t:now.t.clone(), d:300, az:-90, el:42 };
  let spin = 0;
  // the same heading, expressed closest to where the camera already is, so it never goes the long way round
  const nearAz = az => now.az + ((((az - now.az) % 360) + 540) % 360 - 180);
  function place(){
    const az = THREE.MathUtils.degToRad(now.az), el = THREE.MathUtils.degToRad(now.el);
    camera.position.set(now.t.x + now.d*Math.cos(el)*Math.cos(az), now.t.y + now.d*Math.cos(el)*Math.sin(az), now.t.z + now.d*Math.sin(el));
    camera.lookAt(now.t);
    scene.fog.near = now.d*.84; scene.fog.far = now.d*1.9;
    camera.updateMatrixWorld();
  }

  // ---------- touch: drag to turn it, tap to choose ----------
  let down = null, frame = 0, running = false, last = 0, onTap = null;
  const hooks = new Set(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e => { down = { x:e.clientX, y:e.clientY, az:want.az, el:want.el, moved:false }; try { canvas.setPointerCapture(e.pointerId); } catch(err) {} spin = 0; });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX-down.x, dy = e.clientY-down.y;
    if (Math.hypot(dx,dy) > 6) down.moved = true;
    if (down.moved){
      const r = canvas.getBoundingClientRect(), next = down.az - dx/r.width*150;
      spin = THREE.MathUtils.clamp(next - want.az, -2.5, 2.5); want.az = next;
      want.el = THREE.MathUtils.clamp(down.el + dy/r.height*60, 18, 80);
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (down && !down.moved && onTap){
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickable).find(h => h.point.z < 14.6 && h.point.z > 11.45);
      const m = hit && /^t_(.+)_(\d+)$/.exec(hit.object.name);
      onTap(m ? { tool:m[1], unit:head.tools[m[1]].units.findIndex(u => u.key===hit.object.name) } : {});
    }
    down = null;
  });

  function size(){
    const host = canvas.parentElement; if (!host) return;
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  }
  function loop(ts){
    if (!running) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(.05, (ts-last)/1000 || .016); last = ts;
    const k = 1-Math.exp(-dt*3);
    if (!down && Math.abs(spin) > .01){ want.az += spin; spin *= .92; }
    now.t.lerp(want.t, k); now.d += (want.d-now.d)*k; now.az += (want.az-now.az)*k; now.el += (want.el-now.el)*k;
    const c = 1-Math.exp(-dt*5);
    for (const p of Object.values(parts)){ p.mm.color.lerp(p.fill, c); p.lm.color.lerp(p.line, c); p.lm.opacity += (p.op-p.lm.opacity)*c; p.lm2.color.copy(p.lm.color); p.lm2.opacity = p.lm.opacity*.42; }
    place();
    renderer.render(scene, camera);
    hooks.forEach(fn => fn());
  }
  const v = new THREE.Vector3();
  const boxOf = ids => {
    const lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
    ids.forEach(id => head.tools[id].units.forEach(u => { for (let i = 0; i < 3; i++){ lo[i] = Math.min(lo[i], u.min[i]); hi[i] = Math.max(hi[i], u.max[i]); } }));
    return { lo, hi };
  };
  return {
    canvas,
    tools: head.tools,
    attach(host){ if (canvas.parentElement!==host) host.appendChild(canvas); size(); this.start(); },
    start(){ if (running) return; running = true; last = performance.now(); frame = requestAnimationFrame(loop); },
    stop(){ running = false; cancelAnimationFrame(frame); hooks.clear(); onTap = null; },
    resize: size,
    setTap(fn){ onTap = fn; },
    addHook(fn){ hooks.add(fn); },
    clearHooks(){ hooks.clear(); },
    choose(zone){ chosen = zone; restyle(); },
    // per machine: open glows, busy goes quiet, dim steps back. Anything not named takes the default
    setUnits(map, fallback){ unitState = map || {}; toolDefault = fallback || 'idle'; restyle(); },
    // the whole building, both floors stacked, far enough back to read them both
    // facing a wing's aisle when given one, so the fly-in that follows is a glide, not a turn
    wholeBuilding(wing){ want.t.set(0,-8,8); want.az = AISLE[wing] ?? -90; want.el = 42; want.d = Math.max(30/(Math.tan(THREE.MathUtils.degToRad(13))*camera.aspect), 200); },
    // no easing at all: camera and colors land where they are headed
    jump(){ now.t.copy(want.t); now.d = want.d; now.az = want.az; now.el = want.el; place(); for (const p of Object.values(parts)){ p.mm.color.copy(p.fill); p.lm.color.copy(p.line); p.lm.opacity = p.op; p.lm2.color.copy(p.lm.color); p.lm2.opacity = p.op*.42; } },
    // frame a set of tools from out in the aisle
    flyToTools(ids, wing, o){
      o = o || {};
      const { lo, hi } = boxOf(ids);
      want.t.set((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, 12.3);
      want.az = nearAz(AISLE[wing]); want.el = o.el || 40;
      // far enough that the longest side fits the narrower way of the picture
      const half = Math.tan(THREE.MathUtils.degToRad(13)), span = Math.hypot(hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]);
      want.d = Math.max(o.min || 12, (span/2 + (o.pad || 3)) / (half*Math.min(1, camera.aspect)));
    },
    flyToUnit(id, n, wing){
      const u = head.tools[id].units[n]; if (!u) return;
      want.t.set((u.min[0]+u.max[0])/2, (u.min[1]+u.max[1])/2, 12.4);
      want.az = nearAz(AISLE[wing]); want.el = 34; want.d = 15;
    },
    unitsOf: id => head.tools[id].units,
    // where a point in the model lands on the screen, for the labels that ride on top of it
    project(p){
      v.set(p[0], p[1], p[2]).project(camera);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      return { x:(v.x+1)/2*w, y:(1-v.y)/2*h, front:v.z<1 };
    },
  };
}
