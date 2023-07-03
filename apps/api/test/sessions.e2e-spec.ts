import request, { LEGACY_WEBSOCKET_PROTOCOL, supertestWs } from 'supertest-graphql';
import gql from 'graphql-tag';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

import { AppModule } from '../src/app/app.module';
import { setupApplication } from '../src/bootstrap';
import { AuthGuardMock } from './mocks/guards/AuthGuard.mock';
import { AuthGuard } from '../src/app/core/guards/auth.guard';
import { SeedModule } from '../src/app/seed/seed.module';
import { SeedService } from '../src/app/seed/seed.service';
import { UsersData } from '../src/app/seed/data/users.data';

const QUERY_SESSIONS = gql`
  query Sessions {
    sessions {
      id
      name
      description
      owner {
        id
        email
        displayName
      }
      toolbars {
        id
      }
      userSessions {
        id
        owner {
          email
        }
        session {
          id
          name
        }
      }
    }
  }
`;

const CREATE_SESSION = gql`
  mutation CreateSession($createSessionInput: CreateSessionInput!) {
    createSession(createSessionInput: $createSessionInput) {
      id
      name
      description
      status
      start
      end
      toolbars {
        id
      }
    }
  }
`;

const UPDATE_SESSION = gql`
  mutation UpdateSession($id: Int!, $updateSessionInput: UpdateSessionInput!) {
    updateSession(id: $id, updateSessionInput: $updateSessionInput) {
      id
      name
      description
      status
      start
      end
      editable
      enablePlayer
      displaySampleSolution
      enableLiveAnalysis
      toolbars {
        id
      }
    }
  }
`;

const SESSION_UPDATED = gql`
  subscription onSessionUpdated($id: ID!) {
    sessionUpdated(id: $id) {
      id
      name
      description
      status
      start
      end
      editable
      enablePlayer
      displaySampleSolution
      enableLiveAnalysis
    }
  }
`;

const CREATE_SESSION_VARIABLES = {
  createSessionInput: {
    name: 'test',
  },
};

const UPDATE_SESSION_VARIABLES = {
  id: 1,
  updateSessionInput: {
    name: 'updated name',
    description: 'updated description',
    editable: true,
    enablePlayer: true,
    displaySampleSolution: true,
    enableLiveAnalysis: true,
    start: new Date(),
    end: new Date(),
    status: 'CLOSED',
  },
};

const SESSION_UPDATED_VARIABLES = {
  id: 1,
};

describe('Sessions (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        SeedModule,
        AppModule,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(new AuthGuardMock())
      .compile();

    app = moduleFixture.createNestApplication();
    setupApplication(app);
    await app.init();
    const seeder = app.get(SeedService);
    await seeder.seed();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Query Sessions', () => {
    it('Not authenticated user should get "Unauthorized" error', async () => {
      const { errors } = await request(app.getHttpServer()).query(QUERY_SESSIONS);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Unauthorized');
    });

    it('Owner user should get list of all owned sessions and sessions participating', async () => {
      const { data } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionOwner1.id}`, { type: 'bearer' })
        .query(QUERY_SESSIONS)
        .expectNoErrors();

      expect(data).toMatchSnapshot();
    });

    it('Participating user should get list of all sessions participating and see only own user sessions', async () => {
      const { data } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionParticipant1.id}`, { type: 'bearer' })
        .query(QUERY_SESSIONS)
        .expectNoErrors();

      expect(data).toMatchSnapshot();
    });
  });

  describe('Create Session', () => {
    it('Not authenticated user should get "Unauthorized" error', async () => {
      const { errors } = await request(app.getHttpServer()).mutate(CREATE_SESSION).variables(CREATE_SESSION_VARIABLES);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Unauthorized');
    });

    it('SAML Authenticated user can create a new session', async () => {
      const { data } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionOwner1.id}`, { type: 'bearer' })
        .mutate(CREATE_SESSION)
        .variables(CREATE_SESSION_VARIABLES)
        .expectNoErrors();

      expect(data).toMatchSnapshot();
    });

    it('None SAML Authenticated user cannot create a new session', async () => {
      const { errors } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionParticipant1.id}`, { type: 'bearer' })
        .mutate(CREATE_SESSION)
        .variables(CREATE_SESSION_VARIABLES);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Forbidden resource');
    });
  });

  describe('Update Session', () => {
    it('Not authenticated user should get "Unauthorized" error', async () => {
      const { errors } = await request(app.getHttpServer()).mutate(UPDATE_SESSION).variables(UPDATE_SESSION_VARIABLES);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Unauthorized');
    });

    it('Session Owner can update a session', async () => {
      const { data } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionOwner1.id}`, { type: 'bearer' })
        .mutate(UPDATE_SESSION)
        .variables(UPDATE_SESSION_VARIABLES)
        .expectNoErrors();

      expect(data).toMatchSnapshot({
        updateSession: {
          start: expect.any(String),
          end: expect.any(String),
        },
      });
    });

    it('Session Owner or another session cannot update a session and should get "Not Found" error', async () => {
      const { errors } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionOwner2.id}`, { type: 'bearer' })
        .mutate(UPDATE_SESSION)
        .variables(UPDATE_SESSION_VARIABLES);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Not Found');
    });

    it('Participant (None SAML Authenticated user) cannot update a session and should get "Forbidden resource" error', async () => {
      const { errors } = await request(app.getHttpServer())
        .auth(`${UsersData.sessionParticipant1.id}`, { type: 'bearer' })
        .mutate(UPDATE_SESSION)
        .variables(UPDATE_SESSION_VARIABLES);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Forbidden resource');
    });

    it('Session Update trickers SessionUpdated Subscription', async () => {
      app.getHttpServer().listen().address();
      const sub = await supertestWs(app.getHttpServer())
        .protocol(LEGACY_WEBSOCKET_PROTOCOL)
        .subscribe(SESSION_UPDATED)
        .variables(SESSION_UPDATED_VARIABLES);

      await request(app.getHttpServer())
        .auth(`${UsersData.sessionOwner1.id}`, { type: 'bearer' })
        .mutate(UPDATE_SESSION)
        .variables(UPDATE_SESSION_VARIABLES)
        .expectNoErrors();

      const { data } = await sub.next().expectNoErrors();

      expect(data).toMatchSnapshot({
        sessionUpdated: {
          start: expect.any(String),
          end: expect.any(String),
        },
      });
    });
  });
});
