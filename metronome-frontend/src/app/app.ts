import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { BpmSliderComponent } from './components/bpm-slider/bpm-slider.component';
import { ControlsComponent } from './components/controls/controls.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BpmSliderComponent, ControlsComponent],
  template: `
    @if (auth.userProfile(); as profile) {
      <div style="text-align: center; margin-bottom: 15px;">
        <img [src]="profile.avatarUrl" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid #ddd;">
        <p style="margin: 5px 0; font-weight: bold;">[ {{ profile.name }} ]</p>
      </div>
    }

    <div class="container">
      <h2>Metronome</h2>
      <app-bpm-slider />
      <app-controls />
    </div>
    
    @if (!auth.isDiscordEnv) {
      <div class="demo-banner">🎵 <b>Demo Mode</b> — Open in Discord to sync your profile.</div>
    }
  `
})
export class App implements OnInit {
  auth = inject(AuthService);

  ngOnInit() {
    this.auth.init();
  }
}
