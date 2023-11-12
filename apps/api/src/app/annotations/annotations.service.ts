import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSessionsService } from '../user-sessions/user-sessions.service';
import { User } from '../users/entities/user.entity';
import { CreateAnnotationInput } from './dto/create-annotation.input';
import { UpdateAnnotationInput } from './dto/update-annotation.input';
import { Annotation } from './entities/annotation.entity';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private annotationsRepository: Repository<Annotation>,
    @Inject(forwardRef(() => UserSessionsService))
    private readonly userSessionsService: UserSessionsService
  ) {}

  async create(createAnnotationInput: CreateAnnotationInput, user: User) {
    const userSession = await this.userSessionsService.findOne(createAnnotationInput.userSessionId, user);

    const newAnnotation = this.annotationsRepository.create({
      start: createAnnotationInput.start,
      end: createAnnotationInput.end,
      value: createAnnotationInput.value,
      marker: {
        id: createAnnotationInput.markerId,
      },
      userSession: {
        id: userSession.id,
      },
      media: {
        id: createAnnotationInput.mediaId,
      },
      note: createAnnotationInput.note,
    });

    // check for events or sliders/ranges
    if (newAnnotation.value == undefined) {
      return this.annotationsRepository.save(newAnnotation);
    }

    const allAnnotations = await this.annotationsRepository.findBy({
      markerId: createAnnotationInput.markerId,
    });

    // delete all annotations that are in the future of the curren one being created
    const futureAnnotations = allAnnotations.filter((annotation) => {
      if (annotation.start > newAnnotation.start) {
        return true;
      }
    });

    const updatedAnnotations = allAnnotations.map((annotation) => {
      if (annotation.start < newAnnotation.start) {
        if (annotation.end > newAnnotation.start) {
          annotation.end = newAnnotation.start;
        }
      }

      return annotation;
    });

    await this.annotationsRepository.save(updatedAnnotations);
    await this.annotationsRepository.remove(futureAnnotations);
    return this.annotationsRepository.save(newAnnotation);
  }

  findAllByUserSession(userSessionId: number) {
    return this.annotationsRepository.findBy({
      userSessionId,
    });
  }

  async findOne(id: number, user?: User) {
    const annotation = await this.annotationsRepository.findOne({
      where: { id },
      relations: {
        userSession: true,
      },
    });

    if (!annotation) {
      throw new NotFoundException();
    }

    if (user && annotation.userSession.ownerId !== user.id) {
      throw new ForbiddenException();
    }

    return annotation;
  }

  async update(id: number, updateAnnotationInput: UpdateAnnotationInput, user: User) {
    const annotation = await this.findOne(id, user);

    this.annotationsRepository.merge(annotation, {
      note: updateAnnotationInput.note,
      ...(updateAnnotationInput.mediaId && { media: { id: updateAnnotationInput.mediaId } }),
    });

    return this.annotationsRepository.save(annotation);
  }

  async removeMedia(id: number, user: User) {
    const annotation = await this.findOne(id, user);
    this.annotationsRepository.update(id, {
      mediaId: null,
      media: null,
    });

    return { ...annotation, mediaId: null, media: null };
  }

  async remove(id: number, user: User) {
    let annotation = await this.findOne(id, user);

    if (!annotation) {
      throw new NotFoundException();
    }

    await this.annotationsRepository.remove(annotation);

    //return updated entity
    annotation = await this.findOne(id, user);
    return annotation;
  }
}
