import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SessionsRoutingModule } from './sessions-routing.module';
import { SessionsOverviewPage } from './pages/sessions-overview/sessions-overview.component';
import { SessionsService } from './services/sessions.service';

//material modules
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';

import { SessionsOverviewTableComponent } from './components/sessions-overview-table/sessions-overview-table.component';
import { SessionCreatePage } from './pages/session-create/session-create.component';
import { SessionBasicDataComponent } from './components/session-basic-data/session-basic-data.component';

@NgModule({
  declarations: [
    SessionsOverviewPage,
    SessionsOverviewTableComponent,
    SessionCreatePage,
    SessionBasicDataComponent,
  ],
  imports: [
    CommonModule,
    SessionsRoutingModule,
    MatButtonModule,
    MatInputModule,
    MatTableModule,
    MatIconModule
  ],
  providers: [SessionsService]
})
export class SessionsModule { }
