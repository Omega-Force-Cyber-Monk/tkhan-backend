import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SendMessageDto, StartConversationDto } from './dto/chat.dto';
@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly uploads: UploadsService,
  ) {}
  @Post('conversations') start(
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConversationDto,
  ) {
    return this.chatService.start(user.sub, dto).then((conversation) => {
      this.chatGateway.emitConversationCreated(conversation);
      return conversation;
    });
  }
  @Get('conversations') conversations(@CurrentUser() user: AuthUser) {
    return this.chatService.conversations(user.sub);
  }
  @Get('conversations/:id/messages') messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.chatService.messages(user.sub, id);
  }
  @Post('messages')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['conversationId', 'type'],
      properties: {
        conversationId: { type: 'string' },
        type: { type: 'string', enum: ['TEXT', 'IMAGE', 'FILE'] },
        body: { type: 'string' },
        attachment: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('attachment'))
  async send(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    dto.attachmentUrl = await this.uploads.uploadFile(
      file,
      'tkhan/chat-attachments',
    );
    const payload = await this.chatService.sendWithConversation(user.sub, dto);
    this.chatGateway.emitMessageCreated(payload.conversation, payload.message);
    return payload.message;
  }
  @Patch('conversations/:id/read') markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.chatService.markRead(user.sub, id).then((receipt) => {
      this.chatGateway.emitMessagesRead(receipt);
      return receipt;
    });
  }
}
