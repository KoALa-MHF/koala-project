import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { IsEmail, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Annotation } from '../../annotations/entities/annotation.entity';
import { BaseEntity } from '../../core/base.entity';
import { Session } from '../../sessions/entities/session.entity';

export enum UserSessionStatus {
  INITIAL = 'initial',
  STARTED = 'started',
  SUBMITTED = 'submitted',
}

export const USER_SESSION_STATUS_DEFAULT = UserSessionStatus.INITIAL;

export const USER_SESSION_NOTE_MAX_LENGTH = 1024;

registerEnumType(UserSessionStatus, {
  name: 'UserSessionStatus',
});

@ObjectType()
@Entity()
@Index(
  [
    'email',
    'session',
  ],
  { unique: true }
)
export class UserSession extends BaseEntity {
  @PrimaryGeneratedColumn()
  @Field(() => Int, { description: 'ID for User Session' })
  id: number;

  @Column({
    type: 'simple-enum',
    enum: UserSessionStatus,
    default: USER_SESSION_STATUS_DEFAULT,
  })
  @Field(() => UserSessionStatus, { defaultValue: USER_SESSION_STATUS_DEFAULT, description: 'User Session Status' })
  @IsEnum(UserSessionStatus)
  @IsNotEmpty()
  status: UserSessionStatus;

  @Column({ nullable: true, length: USER_SESSION_NOTE_MAX_LENGTH })
  @Field({ nullable: true, description: 'User Session Note' })
  @MaxLength(USER_SESSION_NOTE_MAX_LENGTH)
  note?: string;

  @JoinColumn({ name: 'sessionId' })
  @ManyToOne(() => Session)
  @Field((type) => Session, { description: 'Associated Session' })
  @IsNotEmpty()
  session: Session;

  @Column({ nullable: false })
  sessionId: number;

  @Column()
  @Field({ description: 'User Session Email' })
  @IsEmail()
  email: string;

  @Column({ nullable: true })
  @Field({ description: 'Invitation Date' })
  invitedAt: Date;

  @JoinColumn()
  @OneToMany(() => Annotation, (annotation) => annotation.userSession)
  @Field(
    (type) => [
      Annotation,
    ],
    { description: 'Associated Annotations' }
  )
  @IsNotEmpty()
  annotations: Annotation[];
}
