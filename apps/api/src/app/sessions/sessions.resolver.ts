import { Resolver, Query, Mutation, Args, Int, ResolveField, Parent } from '@nestjs/graphql';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';
import { CreateSessionInput } from './dto/create-session.input';
import { UpdateSessionInput } from './dto/update-session.input';
import { MediaService } from '../media/media.service';
import { ToolbarsService } from '../toolbars/toolbars.service';
import { forwardRef, Inject, UseGuards } from '@nestjs/common';
import { UserSessionsService } from '../user-sessions/user-sessions.service';
import { AuthGuard } from '../core/guards/auth.guard';
import { CurrentUser } from '../core/decorators/user.decorator';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RegisteredUserGuard } from '../core/guards/registerd-user.guard';

@Resolver(() => Session)
@UseGuards(AuthGuard)
export class SessionsResolver {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly mediaService: MediaService,
    @Inject(forwardRef(() => ToolbarsService))
    private readonly toolbarsService: ToolbarsService,
    @Inject(forwardRef(() => UserSessionsService))
    private readonly userSessionsService: UserSessionsService,
    private readonly usersService: UsersService
  ) {}

  @Mutation(() => Session)
  @UseGuards(RegisteredUserGuard)
  createSession(@Args('createSessionInput') createSessionInput: CreateSessionInput, @CurrentUser() user: User) {
    return this.sessionsService.create(createSessionInput, user);
  }

  @Query(
    () => [
      Session,
    ],
    { name: 'sessions' }
  )
  findAll(@CurrentUser() user: User) {
    return this.sessionsService.findAll(user);
  }

  @Query(() => Session, { name: 'session' })
  findOne(@Args('id', { type: () => Int }) id: number, @CurrentUser() user: User) {
    return this.sessionsService.findOne(id, user);
  }

  @Mutation(() => Session)
  @UseGuards(RegisteredUserGuard)
  updateSession(
    @Args('id', { type: () => Int }) id: number,
    @Args('updateSessionInput') updateSessionInput: UpdateSessionInput,
    @CurrentUser() user: User
  ) {
    return this.sessionsService.update(id, updateSessionInput, user);
  }

  @Mutation(() => Session)
  @UseGuards(RegisteredUserGuard)
  removeSession(@Args('id', { type: () => Int }) id: number, @CurrentUser() user: User) {
    return this.sessionsService.remove(id, user);
  }

  @ResolveField()
  media(@Parent() session: Session) {
    const { mediaId } = session;
    if (mediaId) {
      return this.mediaService.findOne(mediaId);
    }
  }

  @ResolveField()
  toolbars(@Parent() session: Session) {
    return this.toolbarsService.findAll(session.id);
  }

  @ResolveField()
  owner(@Parent() session: Session) {
    const { ownerId } = session;
    return this.usersService.findOne(ownerId);
  }

  @ResolveField()
  userSessions(@Parent() session: Session, @CurrentUser() user: User) {
    return this.userSessionsService.findAllBySession(session.id, user);
  }
}
