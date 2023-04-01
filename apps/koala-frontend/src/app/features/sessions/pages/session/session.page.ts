import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { MarkerService } from '../../services/marker.service';
import { MessageService } from 'primeng/api';
import { MediaControlService, MediaEvent, MediaActions } from '../../services/media-control.service';
import { SessionsService } from '../../services/sessions.service';
import { environment } from '../../../../../environments/environment';
import { Session } from '../../types/session.entity';
import { DataPoint, Display } from '../../components/annotation/annotation.component';
import { Marker } from '../../types/marker.entity';
import { MarkerType } from '../../../../graphql/generated/graphql';
import { ToolbarMode } from '../../components/marker-toolbar/marker-toolbar.component';
import { FormGroup, FormControl, FormBuilder } from '@angular/forms';

@Component({
  selector: 'koala-app-session',
  templateUrl: './session.page.html',
  styleUrls: [
    './session.page.scss',
  ],
})
export class SessionPage implements OnInit {
  sidePanelForm: FormGroup;
  ToolbarMode = ToolbarMode;

  waveContainer!: string;
  mediaUri: string = environment.production ? 'https://koala-app.de/api/media' : 'http://localhost:4200/api/media';
  sessionId = 0;
  session!: Session;
  AnnotationData: Map<number, Array<DataPoint>> = new Map<number, Array<DataPoint>>();
  AnnotationDislay = Display;
  markers: Marker[] = [];
  currentAudioTime = 0;
  totalAudioTime = 0;
  audioPaused = true;
  showSideBar = false;

  constructor(
    private readonly sessionService: SessionsService,
    private readonly markerService: MarkerService,
    private readonly route: ActivatedRoute,
    private mediaControlService: MediaControlService,
    private readonly messageService: MessageService,
    private readonly translateService: TranslateService,
    private readonly formBuilder: FormBuilder
  ) {
    this.sidePanelForm = this.formBuilder.group({
      details: this.formBuilder.group({
        editable: new FormControl<boolean>(false),
        enablePlayer: new FormControl<boolean>(false),
        displaySampleSolution: new FormControl<boolean>(false),
        enableLiveAnalysis: new FormControl<boolean>(false),
      }),
      markersArray: this.formBuilder.group({}),
    });
  }

  ngOnInit(): void {
    this.sessionId = parseInt(this.route.snapshot.paramMap.get('sessionId') || '0');
    this.sessionService.getOne(this.sessionId).subscribe((result) => {
      this.session = {
        ...result.data?.session,
        media: result.data?.session.media,
      };
      if (this.session.media == undefined) {
        this.showErrorMessage('error', 'SESSION.ERROR_DIALOG.NO_AUDIO_FILE', 'SESSION.ERROR_DIALOG.NO_AUDIO_FILE_SUM');
        return;
      }
      this.mediaControlService.uuid = this.session.id;
      this.waveContainer = `waveContainer-${this.session.id}`;
      this.loadMediaData(this.session.media.id);
      this.setSidePanelFormData();
      this.loadMarkerData();
    });
  }

  private loadMediaData(id: string): void {
    try {
      this.mediaControlService.load(`${this.mediaUri}/${id}`, this.waveContainer).then(() => {
        this.mediaControlService.addEventHandler('audioprocess', (time) => {
          // to reduce update frequency
          this.currentAudioTime = time.toFixed(2);
        });
        this.mediaControlService.addEventHandler('ready', () => {
          this.totalAudioTime = this.mediaControlService.getDuration();
        });
        this.mediaControlService.addEventHandler('pause', () => {
          this.audioPaused = true;
        });
        this.mediaControlService.addEventHandler('play', () => {
          this.audioPaused = false;
        });
      });
    } catch (e) {
      this.showErrorMessage('error', 'SESSION.ERROR_DIALOG.BROKEN_AUDIO_FILE', 'SESSION.ERROR_DIALOG.SUMMARY');
      console.log(e);
    }
  }

  private setSidePanelFormData(): void {
    this.sidePanelForm.get('details')?.get('editable')?.setValue(this.session.editable);
    this.sidePanelForm.get('details')?.get('enablePlayer')?.setValue(this.session.enablePlayer);
    this.sidePanelForm.get('details')?.get('displaySampleSolution')?.setValue(this.session.displaySampleSolution);
    this.sidePanelForm.get('details')?.get('enableLiveAnalysis')?.setValue(this.session.enableLiveAnalysis);
  }

  private loadMarkerData(): void {
    const markers = this.session?.toolbars[0]?.markers || [];
    const markerIds: Array<number> = markers.map((marker) => parseInt(marker));
    this.markerService.getAll(markerIds).subscribe((result) => {
      const markers = result.data?.markers;
      for (const marker of markers) {
        const m = { hidden: false, ...marker };
        this.markers.push(m);
        this.markersFormGroup.addControl(marker.id + '', new FormControl(true));
        this.AnnotationData.set(marker.id, new Array<DataPoint>());
      }
      this.markers = [
        ...this.markers,
      ];
      this.onSidePanelFormChanges();
    });
  }

  getAudioMetadata() {
    try {
      return this.mediaControlService.getMetadata();
    } catch (error) {
      return undefined;
    }
  }

  onMarkerButtonEvent(m: Marker) {
    if (this.audioPaused) {
      return;
    }
    let aData = this.AnnotationData.get(m.id);
    if (aData == undefined) {
      // wtf typescript, how is this still undefined...
      aData = this.AnnotationData.set(m.id, new Array<DataPoint>()).get(m.id);
    } else {
      if (m.type == MarkerType.Event) {
        this.onMarkerEvent(m, aData);
      }
      if (m.type == MarkerType.Range) {
        this.onMarkerRange(m, aData);
      }
    }
  }

  onMarkerEvent(m: Marker, aData: DataPoint[]) {
    const t = this.mediaControlService.getCurrentTime();
    this.AnnotationData.get(m.id)?.push({
      startTime: t,
      endTime: 0,
      strength: 0,
      id: aData.length,
      color: m.color,
      disply: Display.Circle,
    });
  }

  onMarkerRange(m: Marker, aData: DataPoint[]) {
    const t = this.mediaControlService.getCurrentTime();
    if (aData.length > 0) {
      const latest = aData.at(-1);
      if (latest?.endTime == 0) {
        latest.endTime = this.mediaControlService.getCurrentTime();
        return;
      }
    }
    this.AnnotationData.get(m.id)?.push({
      startTime: t,
      endTime: 0,
      strength: 0,
      id: aData.length,
      color: m.color,
      disply: Display.Rect,
    });
  }

  onMarkerSliderRange(m: Marker, aData: DataPoint[]) {
    const strength = m.id; // todo: until we have a field in the Marker interface
    if (this.audioPaused) {
      return;
    }
    const t = this.mediaControlService.getCurrentTime();
    if (aData.length == 0) {
      aData.push({
        startTime: t,
        endTime: 0,
        strength: strength,
        id: 1,
        color: m.color,
        disply: Display.Rect,
      });
      return;
    }
    const latest = aData.at(-1);
    if (latest && latest.strength != strength) {
      if (latest.endTime == 0) {
        latest.endTime = t;
      }
      if (strength != 0) {
        aData.push({
          startTime: t,
          endTime: 0,
          strength: strength,
          id: aData.length,
          color: m.color,
          disply: Display.Rect,
        });
      }
      this.AnnotationData.set(m.id, aData);
    }
  }

  onMediaEvent(evt: MediaEvent) {
    switch (evt.actions) {
      case MediaActions.Play:
        try {
          this.mediaControlService.togglePlay();
        } catch (error) {
          this.showErrorMessage('error', 'SESSION.ERROR_DIALOG.MEDIA_CONTROLS', 'SESSION.ERROR_DIALOG.ERRORS.SUMMARY');
        }
        break;
      case MediaActions.Stop:
        try {
          this.mediaControlService.stop();
        } catch (error) {
          this.showErrorMessage('error', 'SESSION.ERROR_DIALOG.MEDIA_CONTROLS', 'SESSION.ERROR_DIALOG.ERRORS.SUMMARY');
        }
        break;
      case MediaActions.SkipForward:
        try {
          this.mediaControlService.skipForward();
        } catch (error) {
          this.showErrorMessage('error', 'SESSION.ERROR_DIALOG.MEDIA_CONTROLS', 'SESSION.ERROR_DIALOG.ERRORS.SUMMARY');
        }
        break;
      case MediaActions.SkipBackward:
        try {
          this.mediaControlService.skipBackward();
        } catch (error) {
          this.showErrorMessage('error', 'SESSION.ERROR_DIALOG.MEDIA_CONTROLS', 'SESSION.ERROR_DIALOG.ERRORS.SUMMARY');
        }
        break;
      case MediaActions.VolumeChange:
        if (evt.value != undefined) {
          try {
            this.mediaControlService.onVolumeChange(evt.value);
          } catch (error) {
            this.showErrorMessage(
              'error',
              'SESSION.ERROR_DIALOG.MEDIA_CONTROLS',
              'SESSION.ERROR_DIALOG.ERRORS.SUMMARY'
            );
          }
        }
        break;
      case MediaActions.Mute:
        if (evt.value != undefined) {
          try {
            this.mediaControlService.onMute(evt.value);
          } catch (error) {
            this.showErrorMessage(
              'error',
              'SESSION.ERROR_DIALOG.MEDIA_CONTROLS',
              'SESSION.ERROR_DIALOG.ERRORS.SUMMARY'
            );
          }
        }
        break;
    }
  }

  private showErrorMessage(severity: string, detail: string, sum: string) {
    this.translateService
      .get([
        detail,
        sum,
      ])
      .subscribe((results: Record<string, string>) => {
        this.messageService.add({
          severity: severity,
          summary: results[sum],
          detail: results[detail],
        });
      });
  }

  onSidePanelFormChanges(): void {
    this.sidePanelForm.get('markersArray')?.valueChanges.subscribe((val) => {
      Object.keys(val).forEach((key) => {
        this.markers.forEach((marker) => {
          if (marker.id == Number(key)) {
            marker.hidden = !val[key];
          }
        });
      });
      this.markers = [
        ...this.markers,
      ];
    });
    this.sidePanelForm.get('details')?.valueChanges.subscribe((details) => {
      this.sessionService
        .update(parseInt(this.session?.id || '0'), {
          editable: details.editable,
          enablePlayer: details.enablePlayer,
          displaySampleSolution: details.displaySampleSolution,
          enableLiveAnalysis: details.enableLiveAnalysis,
        })
        .subscribe({
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: this.translateService.instant('SESSION.MAINTAIN.SESSION_SETTINGS.SAVE_ERROR_MESSAGE_TITLE'),
            });
          },
        });
    });
  }

  get sessionDetailsFormGroup(): FormGroup {
    return this.sidePanelForm.get('details') as FormGroup;
  }

  get markersFormGroup(): FormGroup {
    return this.sidePanelForm.get('markersArray') as FormGroup;
  }
}
