import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Mesh, MeshTopology } from '../types';

/** Three.js preview: shaded mesh + cut edges highlighted in red. */
export class Viewer3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private modelGroup = new THREE.Group();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xf2f2f5);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(2, 1.5, 3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);
    this.scene.add(this.modelGroup);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(container);
    resize();

    const loop = () => {
      requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  setMesh(mesh: Mesh, topology?: MeshTopology): void {
    this.modelGroup.clear();

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(mesh.faces.length * 3);
    for (let i = 0; i < mesh.faces.length; i++) {
      pos[3 * i] = mesh.positions[3 * mesh.faces[i]];
      pos[3 * i + 1] = mesh.positions[3 * mesh.faces[i] + 1];
      pos[3 * i + 2] = mesh.positions[3 * mesh.faces[i] + 2];
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf8f4e8,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.modelGroup.add(new THREE.Mesh(geo, mat));

    // fold edges: light; cut/boundary edges: red
    if (topology) {
      const cutPts: number[] = [];
      const foldPts: number[] = [];
      for (const e of topology.edges) {
        const target = e.kind === 'cut' || e.kind === 'boundary' ? cutPts : e.kind === 'fold' ? foldPts : null;
        if (!target) continue;
        target.push(
          mesh.positions[3 * e.v0], mesh.positions[3 * e.v0 + 1], mesh.positions[3 * e.v0 + 2],
          mesh.positions[3 * e.v1], mesh.positions[3 * e.v1 + 1], mesh.positions[3 * e.v1 + 2],
        );
      }
      const mkLines = (pts: number[], color: number, width: number) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
        const m = new THREE.LineBasicMaterial({ color, linewidth: width });
        return new THREE.LineSegments(g, m);
      };
      if (foldPts.length) this.modelGroup.add(mkLines(foldPts, 0xb0a890, 1));
      if (cutPts.length) this.modelGroup.add(mkLines(cutPts, 0xd02020, 2));
    }

    // frame the model
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(0.7, 0.5, 1).normalize().multiplyScalar(size * 1.6));
    this.camera.near = size / 100;
    this.camera.far = size * 20;
    this.camera.updateProjectionMatrix();
  }
}
