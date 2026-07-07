import { Injectable, signal } from '@angular/core';
import { DiscordSDK } from '@discord/embedded-app-sdk'; // ✅ Import directly from npm
import { MetronomeService } from './metronome.service';

// Tell TypeScript about the variable injected by the backend
declare global {
  interface Window {
    DISCORD_CLIENT_ID: string;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly userId = signal<string | null>(null);
  readonly userProfile = signal<{ name: string, avatarUrl: string } | null>(null);
  readonly isDiscordEnv = new URLSearchParams(window.location.search).has('frame_id');

  constructor(private metronome: MetronomeService) {}

  async init() {
    if (this.isDiscordEnv) await this.setupDiscordSDK();
    else this.setupGuestMode();
  }

  private async setupDiscordSDK() {
    // ✅ No more (window as any).DiscordSDK!
    const discordSdk = new DiscordSDK(window.DISCORD_CLIENT_ID);
    await discordSdk.ready();

    const { code } = await discordSdk.commands.authorize({
      client_id: window.DISCORD_CLIENT_ID,
      response_type: 'code', 
      state: '', 
      prompt: 'none', 
      scope: ['identify', 'email']
    });

    const tokenRes = await fetch('/api/token', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    if (!tokenRes.ok) throw new Error("Backend token exchange failed");
    
    const { access_token } = await tokenRes.json();
    const auth = await discordSdk.commands.authenticate({ access_token });
    if (!auth) throw new Error("Discord authentication failed");

    this.userId.set(auth.user.id);
    const name = auth.user.global_name || auth.user.username;
    const avatarUrl = auth.user.avatar 
      ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png` 
      : "/favicon.ico";
    
    this.userProfile.set({ name, avatarUrl });

    // Restore saved BPM
    try {
      const res = await fetch(`/api/user?user_id=${auth.user.id}`);
      if (res.ok) {
        const data = await res.json();
        this.metronome.setBPM(data.bpm);
      }
    } catch (e) { 
      console.warn("Failed to load user prefs:", e); 
      this.metronome.setBPM(90); 
    }

    // Periodic sync
    setInterval(() => this.sendUserPrefs(), 53000);
  }

  private setupGuestMode() {
    this.userId.set("guest");
    const saved = localStorage.getItem('metronome_bpm');
    if (saved) this.metronome.setBPM(Number(saved));
    
    setInterval(() => localStorage.setItem('metronome_bpm', this.metronome.bpm().toString()), 5000);
  }

  async sendUserPrefs() {
    const uid = this.userId();
    if (!uid) return;

    if (!this.isDiscordEnv) {
      localStorage.setItem('metronome_bpm', this.metronome.bpm().toString());
      return;
    }

    const formData = new URLSearchParams();
    formData.append('user_id', uid);
    formData.append('bpm', this.metronome.bpm().toString());

    await fetch('/update_user_prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    }).catch(err => console.warn('Save failed:', err));
  }
}
