import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { TextModelComponent } from './components/text-model/text-model.component';
import { Font } from 'opentype.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatSliderModule,
    MatIconModule,
    TextModelComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-100 flex flex-col">
      <mat-card class="shadow-sm">
        <mat-card-header>
          <mat-card-title>3D Text Generator</mat-card-title>
        </mat-card-header>
      </mat-card>

      <div class="flex-1 flex">
        <!-- Controls Panel -->
        <mat-card class="w-96 shadow-lg p-6 space-y-6 overflow-y-auto">
          <div>
            <mat-form-field class="w-full">
              <mat-label>Text Input</mat-label>
              <input matInput [(ngModel)]="text" placeholder="Enter text...">
            </mat-form-field>
          </div>

          <div>
            <button mat-raised-button (click)="fileInput.click()" class="w-full">
              <mat-icon>upload</mat-icon>
              {{ font() ? 'Change Font' : 'Upload Font' }}
            </button>
            <input #fileInput type="file" accept=".ttf" (change)="handleFontUpload($event)" class="hidden">
          </div>

          <div>
            <mat-form-field class="w-full">
              <mat-label>XY Scale</mat-label>
              <input matInput type="number" [(ngModel)]="scale" min="0.5" step="0.05">
            </mat-form-field>
          </div>

          <div>
            <mat-form-field class="w-full">
              <mat-label>Foreground Depth (mm)</mat-label>
              <input matInput type="number" [(ngModel)]="foregroundDepth" min="0.5" step="0.1">
            </mat-form-field>
          </div>

          <div>
            <mat-form-field class="w-full">
              <mat-label>Background Depth (mm)</mat-label>
              <input matInput type="number" [(ngModel)]="backgroundDepth" min="0.5" step="0.1">
            </mat-form-field>
          </div>
        </mat-card>

        <!-- 3D Viewer -->
        <div class="flex-1">
          <app-text-model
            [text]="text"
            [font]="font()"
            [scale]="scale"
            [foregroundDepth]="foregroundDepth"
            [backgroundDepth]="backgroundDepth"
            [outerOffset]="0.75"
            [innerOffset]="0.5"
            [xOffset]="0"
            [yOffset]="0"
          ></app-text-model>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `]
})
export class AppComponent {
  text = signal('Hello');
  font = signal<Font | null>(null);
  scale = signal(1);
  foregroundDepth = signal(1);
  backgroundDepth = signal(2);

  constructor() {
    this.loadDefaultFont();
  }

  async loadDefaultFont() {
    try {
      const response = await fetch('/fonts/Lucy Said Ok Personal Use.ttf');
      const fontBuffer = await response.arrayBuffer();
      const loadedFont = await import('opentype.js').then(opentype => opentype.parse(fontBuffer));
      this.font.set(loadedFont);
    } catch (err) {
      console.error('Error loading default font:', err);
    }
  }

  async handleFontUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const loadedFont = await import('opentype.js').then(opentype => opentype.parse(buffer));
      this.font.set(loadedFont);
    } catch (err) {
      console.error('Error loading font:', err);
    }
  }
} 