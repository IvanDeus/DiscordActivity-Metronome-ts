import { Component, inject } from '@angular/core';
import { MetronomeService } from '../../services/metronome.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-controls',
  standalone: true,
  template: `
    <div class="controls">
      <button class="control-btn" (click)="adjust(-4)">Slower</button>
      <button class="control-btn" (click)="adjust(4)">Faster</button>
    </div>
    <button class="control-start" (click)="toggle()">
      {{ metronome.isPlaying() ? 'Stop Metronome' : 'Start Metronome' }}
    </button>
  `
})
export class ControlsComponent {
  metronome = inject(MetronomeService);
  auth = inject(AuthService);

  adjust(delta: number) {
    this.metronome.setBPM(this.metronome.bpm() + delta);
    this.auth.sendUserPrefs();
  }

  toggle() {
    this.metronome.togglePlay();
    if (this.metronome.isPlaying()) this.auth.sendUserPrefs();
  }
}
