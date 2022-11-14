import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { MediaType } from '../entities/media.entity';

@InputType()
export class CreateMediaInput {
  @Field(() => MediaType, { description: 'Media Type' })
  @IsEnum(MediaType)
  @IsNotEmpty()
  type: MediaType;

  @Field({ description: 'Media Title' })
  @IsNotEmpty()
  title: string;

  @Field({ description: 'Media Composer' })
  composer: string;
}