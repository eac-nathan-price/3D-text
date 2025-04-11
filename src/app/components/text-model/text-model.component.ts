import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { Font, PathCommand } from 'opentype.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

@Component({
  selector: 'app-text-model',
  standalone: true,
  template: `
    <div class="canvas-container" #container>
      <canvas #canvas></canvas>
      <div *ngIf="isLoading" class="loading-overlay">
        Loading...
      </div>
      <div *ngIf="error" class="error-overlay">
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .canvas-container {
      width: 100%;
      height: 100%;
      position: relative;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .loading-overlay, .error-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 1rem;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 4px;
    }
    .error-overlay {
      background: rgba(255, 0, 0, 0.7);
    }
  `]
})
export class TextModelComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() text: string = '';
  @Input() font: Font | null = null;
  @Input() scale: number = 1;
  @Input() foregroundDepth: number = 1;
  @Input() backgroundDepth: number = 1;
  @Input() outerOffset: number = 0.1;
  @Input() innerOffset: number = 0.1;
  @Input() xOffset: number = 0;
  @Input() yOffset: number = 0;

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private foregroundMesh!: THREE.Mesh;
  private backgroundMesh!: THREE.Mesh;
  private referenceTexture!: THREE.Texture;

  isLoading = true;
  error: string | null = null;

  ngOnInit() {
    this.setupScene();
  }

  ngAfterViewInit() {
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Only update geometry if font or text has changed
    if (changes['font']?.currentValue || changes['text']?.currentValue) {
      if (this.font && this.text) {
        this.updateGeometry();
      }
    }
  }

  private setupScene() {
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.containerRef.nativeElement.clientWidth, this.containerRef.nativeElement.clientHeight);
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);

    // Setup camera
    this.camera.position.z = 5;

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Setup lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(ambientLight, directionalLight);
  }

  private updateGeometry() {
    try {
      // Create reference texture
      this.createReferenceTexture();

      // Create geometries
      const { foregroundGeometry, backgroundGeometry } = this.createGeometries();

      // Create meshes
      if (this.foregroundMesh) this.scene.remove(this.foregroundMesh);
      if (this.backgroundMesh) this.scene.remove(this.backgroundMesh);

      this.foregroundMesh = new THREE.Mesh(
        foregroundGeometry,
        new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );

      this.backgroundMesh = new THREE.Mesh(
        backgroundGeometry,
        new THREE.MeshStandardMaterial({ color: 0x666666, side: THREE.DoubleSide })
      );
      this.backgroundMesh.position.z = -this.backgroundDepth;

      this.scene.add(this.foregroundMesh, this.backgroundMesh);
      this.isLoading = false;
    } catch (error) {
      console.error('Error creating geometry:', error);
      this.error = error instanceof Error ? error.message : 'Failed to create geometry';
      this.isLoading = false;
    }
  }

  private createReferenceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    const fontSize = canvas.height * 0.8;
    ctx.font = `${fontSize}px ${this.font!.names.fontFamily.en}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const textMetrics = ctx.measureText(this.text);
    const scale = (canvas.width * 0.8) / textMetrics.width;
    const finalFontSize = fontSize * scale;

    ctx.font = `${finalFontSize}px ${this.font!.names.fontFamily.en}`;
    ctx.fillText(this.text, canvas.width / 2, canvas.height / 2);

    this.referenceTexture = new THREE.CanvasTexture(canvas);
    this.referenceTexture.needsUpdate = true;
  }

  private createGeometries() {
    const shapes: THREE.Shape[] = [];
    const fontScale = 72;
    
    const textWidth = this.font!.getAdvanceWidth(this.text, fontScale);
    const baseline = (this.font!.ascender + this.font!.descender) / 2;
    
    const path = this.font!.getPath(this.text, -textWidth / 2, baseline / 2, fontScale);
    path.commands.forEach((cmd: PathCommand) => {
      if (cmd.type === 'M') {
        shapes.push(new THREE.Shape());
        shapes[shapes.length - 1].moveTo(cmd.x, -cmd.y);
      } else if (cmd.type === 'L') {
        shapes[shapes.length - 1].lineTo(cmd.x, -cmd.y);
      } else if (cmd.type === 'Q') {
        shapes[shapes.length - 1].quadraticCurveTo(cmd.x1!, -cmd.y1!, cmd.x, -cmd.y);
      } else if (cmd.type === 'C') {
        shapes[shapes.length - 1].bezierCurveTo(cmd.x1!, -cmd.y1!, cmd.x2!, -cmd.y2!, cmd.x, -cmd.y);
      } else if (cmd.type === 'Z') {
        shapes[shapes.length - 1].closePath();
      }
    });

    // Create foreground geometry
    const textGeometry = new THREE.ExtrudeGeometry(shapes, {
      depth: this.foregroundDepth,
      bevelEnabled: false,
      curveSegments: 16
    } as THREE.ExtrudeGeometryOptions);

    // Create background geometry
    const backgroundShapes = shapes.map(shape => {
      const bgShape = new THREE.Shape();
      const points = shape.getPoints(128);
      const offsetPoints = this.createParallelOffset(points, this.outerOffset, false);
      
      offsetPoints.forEach((p, i) => {
        if (i === 0) {
          bgShape.moveTo(p.x, p.y);
        } else {
          bgShape.lineTo(p.x, p.y);
        }
      });
      
      return bgShape;
    });

    const backgroundGeometry = new THREE.ExtrudeGeometry(backgroundShapes, {
      depth: this.backgroundDepth,
      bevelEnabled: false,
      curveSegments: 16
    } as THREE.ExtrudeGeometryOptions);

    // Apply scale and position
    [textGeometry, backgroundGeometry].forEach(geo => {
      geo.scale(this.scale, this.scale, 1);
      geo.computeBoundingBox();
      const center = new THREE.Vector3();
      geo.boundingBox!.getCenter(center);
      geo.translate(-center.x + this.xOffset, -center.y + this.yOffset, 0);
    });

    return { foregroundGeometry: textGeometry, backgroundGeometry };
  }

  private createParallelOffset(points: THREE.Vector2[], offset: number, isHole: boolean = false): THREE.Vector2[] {
    const offsetPoints: THREE.Vector2[] = [];
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      
      const v1 = new THREE.Vector2().subVectors(curr, prev).normalize();
      const v2 = new THREE.Vector2().subVectors(next, curr).normalize();
      
      const n1 = new THREE.Vector2(-v1.y, v1.x);
      const n2 = new THREE.Vector2(-v2.y, v2.x);
      
      const bisector = new THREE.Vector2().addVectors(n1, n2).normalize();
      
      if (isHole) bisector.negate();
      
      const offsetPoint = new THREE.Vector2().addVectors(
        curr,
        bisector.multiplyScalar(offset)
      );
      
      offsetPoints.push(offsetPoint);
    }
    
    return offsetPoints;
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  ngOnDestroy() {
    this.renderer.dispose();
    this.controls.dispose();
  }
} 