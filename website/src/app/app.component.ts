import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  published_at: string;
  draft: boolean;
  assets: ReleaseAsset[];
}

@Component({
  selector: 'ml-root',
  standalone: true,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sceneHost', { static: true }) sceneHost!: ElementRef<HTMLDivElement>;

  version = 'v0.2.7';
  downloadUrl = 'https://github.com/SAIMKAXI/Mothlight/releases/download/v0.2.7/Mothlight-v0.2.7-Android-ARM64.apk';
  downloadReady = false;
  releaseLoading = true;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private pageStack?: THREE.Group;
  private animationFrame = 0;
  private resizeObserver?: ResizeObserver;
  private reducedMotion = false;

  ngOnInit(): void {
    void this.loadLatestRelease();
  }

  ngAfterViewInit(): void {
    this.setupScene();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  private async loadLatestRelease(): Promise<void> {
    try {
      const response = await fetch('https://api.github.com/repos/SAIMKAXI/Mothlight/releases?per_page=20', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub release lookup failed: ${response.status}`);
      const releases = await response.json() as GithubRelease[];
      const latest = releases
        .filter((release) => !release.draft)
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
        .find((release) => release.assets.some((asset) => asset.name.endsWith('-Android-ARM64.apk')));
      const apk = latest?.assets.find((asset) => asset.name.endsWith('-Android-ARM64.apk'));
      if (latest && apk) {
        this.version = latest.tag_name;
        this.downloadUrl = apk.browser_download_url;
        this.downloadReady = true;
      }
    } catch (error) {
      console.warn('Using the last known Mothlight download while release metadata is unavailable.', error);
    } finally {
      this.releaseLoading = false;
    }
  }

  private setupScene(): void {
    const host = this.sceneHost.nativeElement;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      this.camera.position.set(0, 0, 9);

      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      this.renderer.setSize(host.clientWidth, host.clientHeight);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(this.renderer.domElement);

      this.scene.add(new THREE.AmbientLight(0xffffff, 2.1));
      const keyLight = new THREE.DirectionalLight(0xf3e5cb, 3.2);
      keyLight.position.set(-3, 5, 7);
      this.scene.add(keyLight);
      const rimLight = new THREE.PointLight(0xc4d2ad, 26, 18);
      rimLight.position.set(3, -2, 4);
      this.scene.add(rimLight);

      this.pageStack = new THREE.Group();
      this.scene.add(this.pageStack);
      const paper = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.92, metalness: 0.02 });
      const shadowPaper = new THREE.MeshStandardMaterial({ color: 0x777b72, roughness: 0.96 });
      const ink = new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 1 });
      const brass = new THREE.MeshStandardMaterial({ color: 0xb5a17d, metalness: 0.62, roughness: 0.34 });

      for (let i = 0; i < 4; i++) {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(3.45, 4.35, 0.055), i === 0 ? paper : shadowPaper);
        sheet.position.set(i * 0.035, -i * 0.045, -i * 0.075);
        sheet.rotation.z = (i - 1.5) * 0.018;
        this.pageStack.add(sheet);
      }

      for (let i = 0; i < 7; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.012, 0.008), ink);
        line.position.set(-0.05, 1.15 - i * 0.34, 0.06);
        this.pageStack.add(line);
      }

      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 12, 48), brass);
      seal.position.set(1.12, 1.55, 0.12);
      seal.rotation.z = -0.25;
      this.pageStack.add(seal);

      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), brass);
      dot.position.set(1.12, 1.55, 0.14);
      this.pageStack.add(dot);

      this.pageStack.rotation.set(-0.12, -0.25, -0.12);
      this.resizeObserver = new ResizeObserver(() => this.resizeScene());
      this.resizeObserver.observe(host);
      this.animate();
    } catch (error) {
      console.warn('The decorative 3D scene could not be initialized.', error);
    }
  }

  private resizeScene(): void {
    if (!this.renderer || !this.camera) return;
    const host = this.sceneHost.nativeElement;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    if (!this.renderer || !this.scene || !this.camera) return;
    if (this.pageStack && !this.reducedMotion) {
      const time = performance.now() * 0.00045;
      this.pageStack.rotation.y = -0.25 + Math.sin(time) * 0.11;
      this.pageStack.rotation.x = -0.12 + Math.cos(time * 0.8) * 0.035;
      this.pageStack.position.y = Math.sin(time * 1.3) * 0.12;
    }
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };
}