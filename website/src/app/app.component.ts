import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  draft: boolean;
  published_at: string;
  assets: ReleaseAsset[];
};

@Component({
  selector: 'ml-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mothCanvas') mothCanvas?: ElementRef<HTMLCanvasElement>;

  releaseVersion = 'Checking latest build';
  downloadMessage = '';
  downloading = false;

  private latestApkUrl: string | null = null;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private animationFrame = 0;
  private resizeObserver?: ResizeObserver;
  private reducedMotion = false;

  ngOnInit(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void this.loadLatestRelease();
  }

  ngAfterViewInit(): void {
    this.createMothScene();
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
  }

  async downloadLatest(): Promise<void> {
    this.downloading = true;
    this.downloadMessage = 'Finding the latest Android build…';
    try {
      if (!this.latestApkUrl) await this.loadLatestRelease();
      if (!this.latestApkUrl) throw new Error('No Android APK is attached to the latest release yet.');
      window.location.assign(this.latestApkUrl);
    } catch (error) {
      this.downloadMessage = error instanceof Error
        ? error.message
        : 'Could not reach GitHub. Please try again.';
    } finally {
      this.downloading = false;
    }
  }

  private async loadLatestRelease(): Promise<void> {
    try {
      const response = await fetch(
        'https://api.github.com/repos/SAIMKAXI/Mothlight/releases?per_page=50',
        { headers: { Accept: 'application/vnd.github+json' } },
      );
      if (!response.ok) throw new Error('GitHub release lookup is temporarily unavailable.');
      const releases = await response.json() as GithubRelease[];
      const available = releases
        .filter((release) => !release.draft)
        .map((release) => ({
          release,
          apk: release.assets.find((asset) =>
            /^Mothlight-v.+-Android-ARM64\.apk$/i.test(asset.name),
          ),
        }))
        .filter((item): item is { release: GithubRelease; apk: ReleaseAsset } => Boolean(item.apk))
        .sort((a, b) => Date.parse(b.release.published_at) - Date.parse(a.release.published_at));

      const latest = available[0];
      if (!latest) throw new Error('No Android download is available yet.');
      this.latestApkUrl = latest.apk.browser_download_url;
      this.releaseVersion = latest.release.tag_name;
    } catch (error) {
      this.releaseVersion = 'Latest release on GitHub';
      if (error instanceof Error) this.downloadMessage = error.message;
    }
  }

  private createMothScene(): void {
    const canvas = this.mothCanvas?.nativeElement;
    if (!canvas) return;

    try {
      const host = canvas.parentElement;
      if (!host) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 8);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;

      scene.add(new THREE.AmbientLight(0xf2eadb, 2.0));
      const keyLight = new THREE.DirectionalLight(0xe8d9b9, 3.0);
      keyLight.position.set(-3, 4, 5);
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0xc2d3a9, 22, 18);
      rimLight.position.set(3, -1, 3);
      scene.add(rimLight);

      const moth = new THREE.Group();
      scene.add(moth);

      const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0xc2cbb0,
        roughness: 0.78,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      const wingGeometry = new THREE.SphereGeometry(1, 36, 24);
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.scale.set(1.08, 0.72, 0.09);
      leftWing.position.set(-0.72, 0.24, 0);
      leftWing.rotation.z = 0.34;
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.scale.set(1.08, 0.72, 0.09);
      rightWing.position.set(0.72, 0.24, 0);
      rightWing.rotation.z = -0.34;
      moth.add(leftWing, rightWing);

      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.16, 0.82, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x665c52, roughness: 0.9 }),
      );
      body.rotation.z = Math.PI / 2;
      body.position.set(0, -0.12, 0.12);
      moth.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 24, 18),
        new THREE.MeshStandardMaterial({ color: 0x5b5149, roughness: 0.82 }),
      );
      head.position.set(0, 0.28, 0.16);
      moth.add(head);

      const antennaMaterial = new THREE.LineBasicMaterial({ color: 0x6b6258, transparent: true, opacity: 0.85 });
      for (const side of [-1, 1]) {
        const points = [
          new THREE.Vector3(side * 0.07, 0.36, 0.17),
          new THREE.Vector3(side * 0.18, 0.66, 0.17),
          new THREE.Vector3(side * 0.34, 0.78, 0.17),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        moth.add(new THREE.Line(geometry, antennaMaterial));
      }

      const dustGeometry = new THREE.BufferGeometry();
      const dustPositions = new Float32Array(210);
      for (let i = 0; i < dustPositions.length; i += 3) {
        dustPositions[i] = (Math.random() - 0.5) * 8;
        dustPositions[i + 1] = (Math.random() - 0.5) * 5;
        dustPositions[i + 2] = (Math.random() - 0.5) * 2 - 1;
      }
      dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dust = new THREE.Points(
        dustGeometry,
        new THREE.PointsMaterial({ color: 0xf4eee2, size: 0.025, transparent: true, opacity: 0.72 }),
      );
      scene.add(dust);

      this.scene = scene;
      this.renderer = renderer;

      const resize = (): void => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        camera.aspect = width / height;
        camera.position.z = width < 540 ? 9 : 8;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      this.resizeObserver = new ResizeObserver(resize);
      this.resizeObserver.observe(host);
      resize();

      const clock = new THREE.Clock();
      const animate = (): void => {
        this.animationFrame = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        if (!this.reducedMotion) {
          moth.rotation.y = Math.sin(elapsed * 0.36) * 0.14;
          moth.position.y = Math.sin(elapsed * 0.72) * 0.12;
          leftWing.rotation.z = 0.34 + Math.sin(elapsed * 4.2) * 0.12;
          rightWing.rotation.z = -0.34 - Math.sin(elapsed * 4.2) * 0.12;
          dust.rotation.z = elapsed * 0.012;
        }
        renderer.render(scene, camera);
      };
      animate();
    } catch (error) {
      console.warn('Mothlight 3D scene unavailable; the page remains usable.', error);
    }
  }
}
