import { Injectable, signal, computed, effect } from '@angular/core';
import { AudioService } from './audio.service';

@Injectable({ providedIn: 'root' })
export class MetronomeService {
  readonly bpm = signal(90);
  readonly isPlaying = signal(false);
  
  // Computed signals for the UI
  readonly bpmDisplay = computed(() => this.bpm().toString().padStart(3, '0'));
  readonly bpmPercentage = computed(() => ((this.bpm() - 24) / (240 - 24)) * 100);

  private intervalId: any = null;

  constructor(private audio: AudioService) {
    // If BPM changes while playing, restart the interval live
    effect(() => {
      const bpm = this.bpm();
      if (this.isPlaying()) {
        this.restartInterval(bpm);
      }
    });
  }

  setBPM(newBPM: number) {
    const clamped = Math.max(24, Math.min(240, Math.round(newBPM)));
    if (clamped === this.bpm()) return;
    this.bpm.set(clamped);
  }

  togglePlay() {
    if (this.isPlaying()) {
      this.stop();
    } else {
      this.start();
    }
  }

  private start() {
    this.isPlaying.set(true);
    this.audio.playClick(); // Play the first click immediately
    this.restartInterval(this.bpm());
  }

  private stop() {
    this.isPlaying.set(false);
    this.clearInterval();
  }

  // Safely clears the interval WITHOUT touching the isPlaying state
  private restartInterval(bpm: number) {
    this.clearInterval();
    const interval = 60000 / bpm;
    
    this.intervalId = setInterval(() => {
      this.audio.playClick();
    }, interval);
  }

  private clearInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
