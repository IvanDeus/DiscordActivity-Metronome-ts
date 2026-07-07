import { Component, inject, ElementRef, viewChild, HostListener } from '@angular/core';
import { MetronomeService } from '../../services/metronome.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-bpm-slider',
  standalone: true,
  template: `
    <div #slider class="bpm-control" (mousedown)="onStart($event)" (touchstart)="onStart($event)">
      <div class="bpm-level" [style.width.%]="metronome.bpmPercentage()"></div>
    </div>
    <p style="font-weight: bold; margin-top: 5px;">BPM: {{ metronome.bpmDisplay() }}</p>
  `
})
export class BpmSliderComponent {
  metronome = inject(MetronomeService);
  auth = inject(AuthService);
  
  private sliderEl = viewChild<ElementRef>('slider');
  private isDragging = false;

  onStart(e: MouseEvent | TouchEvent) {
    this.isDragging = true;
    this.updatePosition(e);
    e.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:touchmove', ['$event'])
  onMove(e: MouseEvent | TouchEvent) {
    if (this.isDragging) this.updatePosition(e);
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onEnd() {
    if (this.isDragging) {
      this.isDragging = false;
      this.auth.sendUserPrefs();
    }
  }

  private updatePosition(e: MouseEvent | TouchEvent) {
    const clientX = (e as MouseEvent).clientX || (e as TouchEvent).touches[0].clientX;
    const rect = this.sliderEl()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    
    const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newBpm = 24 + (240 - 24) * position;
    this.metronome.setBPM(newBpm);
    e.preventDefault();
  }
}
